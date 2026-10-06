'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { fmt, prettyItem, signed, titleCase } from '@/lib/format';
import type { Session } from '@/lib/load';
import { AWARD_STATUS_LABEL, type AwardStatus } from '@/lib/awards';
import { RefBars, TargetBars, type BarRow } from '../charts/charts';
import { Card, Pill, RiskPill, SectionHead, Segmented } from '../ui';

const AWARD_CLS: Record<AwardStatus, string> = { ok: 'bg-good-bg text-good-ink', tie: 'bg-warn-bg text-warn-ink', mismatch: 'bg-crit-bg text-crit-ink', unverifiable: 'bg-line-2 text-ink-2', missing: 'bg-crit-bg text-crit-ink' };

const SHARE_COLORS = ['var(--peg)', 'var(--pru)', 'var(--s3)', 'var(--s4)', 'var(--s5)'];

export default function ZonasTab({ session }: { session: Session }) {
  const { cur, prev, analysis: a, comparison: c } = session;
  const d = cur.report;
  const [metric, setMetric] = useState<'sacos' | 'galones'>('sacos');
  const zonas = d.results?.zonas ?? [];
  const prevLabel = c ? titleCase(c.prevMonth.replace(/\s*20\d\d/, '')) : undefined;
  const prevZona = (zona: string) => prev?.report.results?.zonas.find((z) => z.zona.toUpperCase() === zona.toUpperCase());
  const metaOf = (sheet: string | null) => {
    const s = d.sellers.find((x) => x.sheet === sheet);
    return s ? { sacos: s.sacos.meta, galones: s.galones.meta } : { sacos: null, galones: null };
  };

  const rows: BarRow[] = zonas
    .map((z) => ({ name: z.zona, sub: z.vendedor !== '-' ? z.vendedor : undefined, value: z[metric] ?? 0, meta: metaOf(z.sheet)[metric], prev: prev ? prevZona(z.zona)?.[metric] ?? null : undefined, sheetValue: d.sellers.find((s) => s.sheet === z.sheet)?.[metric].real ?? null }))
    .sort((x, y) => y.value - x.value);

  // Productos Pruven sumados entre vendedores
  const prods = new Map<string, { obj: number; real: number; by: string[] }>();
  for (const s of d.sellers) {
    const b = s.blocks.find((x) => x.line === 'Pruven');
    for (const i of b?.items.filter((x) => /^VENTAS/i.test(x.name)) ?? []) {
      const k = prettyItem(i.name).replace(/^Ventas /, '');
      const e = prods.get(k) ?? { obj: 0, real: 0, by: [] };
      e.obj += i.obj ?? 0;
      e.real += i.real ?? 0;
      e.by.push(`${s.display.split(' ')[0]} ${fmt(i.pct)}%`);
      prods.set(k, e);
    }
  }
  const pl = [...prods.entries()].map(([k, v]) => ({ k, ...v, p: v.obj ? (v.real / v.obj) * 100 : 0 })).sort((x, y) => y.p - x.p);

  return (
    <div className="grid gap-7">
      <section className="grid items-start gap-3 lg:grid-cols-2">
        <Card className="grid min-w-0 gap-2 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="display text-base font-bold">Ventas por zona contra meta</h3>
            <Segmented label="Unidad" value={metric} onChange={setMetric} options={[['sacos', 'Sacos'], ['galones', 'Galones']]} />
          </div>
          <p className="text-[12.5px] text-ink-3">Barra: vendido según RESULTADOS · marca: meta individual de la hoja del vendedor{prev ? ` · gris: ${prevLabel?.toLowerCase()}` : ''}. Si la hoja del vendedor reporta otra cifra, aparece en el detalle de la barra.</p>
          <TargetBars rows={rows} color={metric === 'sacos' ? 'peg' : 'pru'} unit={metric} prevLabel={prevLabel} />
        </Card>
        <Card className="grid min-w-0 gap-2 px-4 py-4">
          <h3 className="display text-base font-bold">Venta cruzada por zona</h3>
          <p className="text-[12.5px] text-ink-3">Galones Pruven por cada 100 sacos Pegutil · línea punteada: promedio del equipo</p>
          <RefBars color="pru" label="Venta cruzada por zona" refValue={a.teamCross ?? 0} refLabel={`Prom. ${fmt(a.teamCross, 1)}`}
            rows={a.crossSell.map((x) => ({ name: x.zona, value: +x.r.toFixed(1), tip: `<b>${x.zona}</b><br/>${fmt(x.r, 1)} galones por cada 100 sacos` }))} />
          <p className="text-[13px] text-ink-2">Las zonas bajo el promedio tienen clientes que ya compran Pegutil pero no llevan Pruven: es la oportunidad más directa para la línea de galones.</p>
        </Card>
      </section>

      <section className="grid gap-3">
        <SectionHead title="Participación en sacos vendidos" sub="Qué tan concentrado está el volumen del equipo" />
        <Card className="grid gap-3 px-4.5 py-4">
          <div className="flex h-8 gap-0.5 overflow-hidden rounded-md" role="img" aria-label="Participación por zona">
            {a.share.map((s, i) => (
              <motion.i key={s.zona} title={`${s.zona}: ${fmt(s.v)} sacos (${fmt(s.p, 1)}%)`} className="block h-full" style={{ background: SHARE_COLORS[i % 5] }}
                initial={{ width: 0 }} animate={{ width: `${s.p}%` }} transition={{ duration: 0.8, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }} />
            ))}
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-x-4 gap-y-1.5 text-[13px]">
            {a.share.map((s, i) => (
              <span key={s.zona} className="flex items-center gap-2"><i className="size-2.5 shrink-0 rounded-sm" style={{ background: SHARE_COLORS[i % 5] }} />{s.zona}<b className="ml-auto font-semibold">{fmt(s.p, 1)}%</b></span>
            ))}
          </div>
        </Card>
      </section>

      {pl.length > 0 && (
        <section className="grid gap-3">
          <SectionHead title="Línea Pruven por producto" sub="Suma de vendedores con hoja · % de la meta del producto · línea punteada: 100%" />
          <Card className="px-4 py-3">
            <RefBars color="pru" label="Cumplimiento por producto Pruven" refValue={100} refLabel="Meta" suffix="%"
              rows={pl.map((x) => ({ name: x.k, value: +x.p.toFixed(1), tip: `<b>${x.k}</b><br/>Real ${fmt(x.real, 1)} de ${fmt(x.obj)}<br/>${x.by.join(' · ')}` }))} />
          </Card>
        </section>
      )}

      {a.plan.length > 0 && d.metas && (
        <section className="grid gap-3">
          <SectionHead title={`${titleCase(d.metas.title)}: ¿son alcanzables?`} sub="Meta nueva comparada con lo vendido este mes" />
          <Card className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-line font-mono text-[10.5px] tracking-wider text-ink-3 uppercase">
                  {['Vendedor', 'Sacos este mes', 'Meta sacos', 'Crecimiento', 'Pruven este mes', 'Meta Pruven', 'Crecimiento', 'Riesgo'].map((h, i) => (
                    <th key={i} className={clsx('px-3 py-2.5 font-medium whitespace-nowrap', i ? 'text-right' : 'pl-4.5 text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.plan.map((p) => (
                  <tr key={p.vendedor} className="border-b border-line-2 last:border-b-0">
                    <td className="py-2.5 pr-3 pl-4.5">{p.nombre}</td>
                    <td className="px-3 text-right">{fmt(p.realS)}</td>
                    <td className="px-3 text-right">{fmt(p.metaS)}</td>
                    <td className={clsx('px-3 text-right font-semibold', (p.gS ?? 0) > 15 ? 'text-crit-ink' : 'text-good-ink')}>{p.gS == null ? '—' : `${signed(p.gS)}%`}</td>
                    <td className="px-3 text-right">{fmt(p.realP, 1)}</td>
                    <td className="px-3 text-right">{fmt(p.metaP)}</td>
                    <td className={clsx('px-3 text-right font-semibold', (p.gP ?? 0) > 15 ? 'text-crit-ink' : 'text-good-ink')}>{p.gP == null ? '—' : `${signed(p.gP)}%`}</td>
                    <td className="px-3 text-right">{p.risk ? <RiskPill r={p.risk} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-[12.5px] text-ink-3">Pruven = suma de los productos con meta. Riesgo alto: requiere crecer más de 40% en alguna línea; medio: entre 15% y 40%.</p>
        </section>
      )}

      {d.awards.length > 0 && (
        <section className="grid gap-3">
          <SectionHead title="Reconocimientos y variable" sub="Asignados en RESULTADOS y verificados contra las hojas de vendedor" />
          <Card className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-line font-mono text-[10.5px] tracking-wider text-ink-3 uppercase">
                  <th className="py-2.5 pr-3 pl-4.5 text-left font-medium">Criterio</th><th className="px-3 text-left font-medium">Línea</th><th className="px-3 text-left font-medium">Ejecutivo</th><th className="px-3 text-right font-medium">% sobre ventas</th><th className="px-3 text-left font-medium">Verificación</th>
                </tr>
              </thead>
              <tbody>
                {session.awards.map(({ award: w, status, detail }, i) => (
                  <tr key={i} className="border-b border-line-2 align-top last:border-b-0">
                    <td className="py-2.5 pr-3 pl-4.5">{titleCase(w.criterio)}</td>
                    <td className="px-3"><span className="inline-flex items-center gap-1.5"><i className="size-2 rounded-sm" style={{ background: w.line === 'Pegutil' ? 'var(--peg)' : 'var(--pru)' }} />{w.line}</span></td>
                    <td className="px-3">{titleCase(w.ejecutivo)}</td>
                    <td className="px-3 text-right">{w.pct != null ? `${fmt(w.pct, 2)}%` : '—'}</td>
                    <td className="max-w-[340px] px-3 py-2.5">
                      <Pill className={AWARD_CLS[status]}>{AWARD_STATUS_LABEL[status]}</Pill>
                      <p className="mt-1 text-[12.5px] leading-snug whitespace-normal text-ink-2">{detail}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </section>
      )}
    </div>
  );
}
