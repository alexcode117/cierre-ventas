'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { Target } from 'lucide-react';
import { fmt, signed, titleCase } from '@/lib/format';
import type { Session } from '@/lib/load';
import { findSeller, findZona, matchProduct } from '@/lib/match';
import { Card, fadeUp, Pill, RiskPill, SectionHead, stagger } from '../ui';

const growthCls = (g: number | null | undefined) => (g == null ? 'text-ink-3' : g > 40 ? 'text-crit-ink' : g > 15 ? 'text-warn-ink' : 'text-good-ink');

export default function MetasTab({ session }: { session: Session }) {
  const d = session.cur.report;
  const a = session.analysis;
  const M = d.metas;
  const month = titleCase((d.month ?? 'este mes').replace(/\s*20\d\d/, '')).toLowerCase();

  if (!M) {
    return (
      <Card className="grid justify-items-start gap-2 px-6 py-7">
        <Target className="text-ink-3" size={26} aria-hidden />
        <h2 className="display text-lg font-bold">El archivo no trae la hoja METAS</h2>
        <p className="max-w-[60ch] text-[14px] text-ink-2">Agregue una hoja llamada METAS con el título &quot;METAS MES &lt;MES&gt;&quot; y una tabla VENDEDOR / SACOS / CAUCHO / … para ver aquí las metas del próximo mes y si son alcanzables.</p>
      </Card>
    );
  }

  const risks = { alto: 0, medio: 0, bajo: 0 };
  for (const p of a.plan) if (p.risk) risks[p.risk]++;
  const iS = M.cols.findIndex((c) => /SACOS/i.test(c));
  const general = M.rows.find((r) => /GENERAL|TOTAL/i.test(r.vendedor));
  const teamSacosMeta = general && iS >= 0 ? general.values[iS] : null;
  const teamSacos = d.results?.total.sacos ?? null;

  /** Valor logrado este mes para una columna de METAS. */
  function actual(vendedor: string, col: string): number | null {
    const s = findSeller(d, vendedor);
    if (/SACOS/i.test(col)) return findZona(d, vendedor)?.sacos ?? s?.sacos.real ?? null;
    if (!s || /CLIENTES/i.test(col)) return null;
    const pru = s.blocks.find((b) => b.line === 'Pruven');
    return pru ? matchProduct(col, pru.items)?.real ?? null : null;
  }

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-7">
      <motion.section variants={fadeUp} className="grid gap-3">
        <div className="grid gap-1">
          <span className="eyebrow">Para la reunión del próximo cierre</span>
          <h2 className="display text-2xl font-bold" style={{ fontStretch: '85%' }}>{titleCase(M.title)}</h2>
          <p className="text-[14px] text-ink-2">Objetivos cargados en la hoja METAS, comparados con lo que cada vendedor logró en {month}.</p>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Card className="grid content-start gap-1.5 px-4.5 py-4">
            <span className="eyebrow">Meta de sacos del equipo</span>
            <div className="display text-[32px] leading-none font-extrabold">{fmt(teamSacosMeta)}</div>
            {teamSacosMeta != null && teamSacos ? (
              <span className={clsx('text-[13px] font-medium', growthCls(((teamSacosMeta / teamSacos) - 1) * 100))}>
                {signed(((teamSacosMeta / teamSacos) - 1) * 100)}% frente a los {fmt(teamSacos)} sacos de {month}
              </span>
            ) : <span className="text-[13px] text-ink-3">Sin total de equipo en METAS</span>}
          </Card>
          <Card className="grid content-start gap-2 px-4.5 py-4">
            <span className="eyebrow">Riesgo de no cumplir</span>
            <div className="flex flex-wrap gap-1.5">
              <RiskPill r="alto" /><b className="mr-2 text-[15px]">{risks.alto}</b>
              <RiskPill r="medio" /><b className="mr-2 text-[15px]">{risks.medio}</b>
              <RiskPill r="bajo" /><b className="text-[15px]">{risks.bajo}</b>
            </div>
            <span className="text-[12.5px] text-ink-3">Alto: requiere crecer más de 40% en alguna línea; medio: entre 15% y 40%.</span>
          </Card>
          <Card className="grid content-start gap-1.5 px-4.5 py-4">
            <span className="eyebrow">Mayor esfuerzo requerido</span>
            {(() => {
              const top = a.plan.filter((p) => p.gS != null || p.gP != null).sort((x, y) => Math.max(y.gS ?? -1e9, y.gP ?? -1e9) - Math.max(x.gS ?? -1e9, x.gP ?? -1e9))[0];
              if (!top) return <span className="text-[13px] text-ink-3">Sin datos</span>;
              const g = Math.max(top.gS ?? -1e9, top.gP ?? -1e9);
              return (
                <>
                  <div className="display text-[22px] leading-tight font-bold" style={{ fontStretch: '85%' }}>{top.nombre}</div>
                  <span className={clsx('text-[13px] font-medium', growthCls(g))}>{signed(g)}% en {g === top.gP ? 'Pruven' : 'sacos'} sobre lo vendido en {month}</span>
                </>
              );
            })()}
          </Card>
        </div>
      </motion.section>

      {a.plan.length > 0 && (
        <motion.section variants={fadeUp} className="grid gap-3">
          <SectionHead title="¿Son alcanzables?" sub={`Meta nueva por línea frente a lo vendido en ${month}`} />
          <Card className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-line font-mono text-[10.5px] tracking-wider text-ink-3 uppercase">
                  {['Vendedor', `Sacos ${month}`, 'Meta sacos', 'Crecimiento', `Pruven ${month}`, 'Meta Pruven', 'Crecimiento', 'Riesgo'].map((h, i) => (
                    <th key={i} className={clsx('px-3 py-2.5 font-medium whitespace-nowrap', i ? 'text-right' : 'pl-4.5 text-left')}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.plan.map((p) => (
                  <tr key={p.vendedor} className="border-b border-line-2 last:border-b-0">
                    <td className="py-2.5 pr-3 pl-4.5 font-semibold">{p.nombre}</td>
                    <td className="px-3 text-right">{fmt(p.realS)}</td>
                    <td className="px-3 text-right">{fmt(p.metaS)}</td>
                    <td className={clsx('px-3 text-right font-semibold', growthCls(p.gS))}>{p.gS == null ? '—' : `${signed(p.gS)}%`}</td>
                    <td className="px-3 text-right">{fmt(p.realP, 1)}</td>
                    <td className="px-3 text-right">{fmt(p.metaP)}</td>
                    <td className={clsx('px-3 text-right font-semibold', growthCls(p.gP))}>{p.gP == null ? '—' : `${signed(p.gP)}%`}</td>
                    <td className="px-3 text-right">{p.risk ? <RiskPill r={p.risk} /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="text-[12.5px] text-ink-3">Pruven = suma de los productos con meta en la hoja METAS. Sacos de {month} según RESULTADOS.</p>
        </motion.section>
      )}

      <motion.section variants={fadeUp} className="grid gap-3">
        <SectionHead title="Detalle por producto" sub={`Meta de cada columna de la hoja METAS · debajo, lo logrado en ${month} y el crecimiento que pide la meta`} />
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-line font-mono text-[10.5px] tracking-wider text-ink-3 uppercase">
                <th className="py-2.5 pr-3 pl-4.5 text-left font-medium">Vendedor</th>
                {M.cols.map((c, i) => <th key={i} className="px-3 py-2.5 text-right font-medium whitespace-nowrap">{titleCase(c)}</th>)}
              </tr>
            </thead>
            <tbody>
              {M.rows.map((r) => {
                const isTotal = /GENERAL|TOTAL/i.test(r.vendedor);
                return (
                  <tr key={r.vendedor} className={clsx('border-b border-line-2 align-top last:border-b-0', isTotal && 'bg-panel-2 font-semibold')}>
                    <td className="py-2.5 pr-3 pl-4.5 whitespace-nowrap">{isTotal ? r.vendedor : findSeller(d, r.vendedor)?.display ?? (() => { const z = findZona(d, r.vendedor); return z && z.vendedor && z.vendedor !== '-' ? z.vendedor : r.vendedor; })()}</td>
                    {M.cols.map((c, i) => {
                      const meta = r.values[i];
                      const real = isTotal ? null : actual(r.vendedor, c);
                      const g = meta != null && real ? ((meta / real) - 1) * 100 : null;
                      return (
                        <td key={i} className="px-3 py-2 text-right whitespace-nowrap">
                          <div className={clsx(meta == null && 'text-ink-3')}>{meta == null ? '—' : fmt(meta)}</div>
                          {real != null && meta != null && (
                            <div className="text-[11.5px] font-normal text-ink-3">
                              {fmt(real, 1)} · <span className={clsx('font-medium', growthCls(g))}>{g == null ? '—' : `${signed(g)}%`}</span>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <p className="text-[12.5px] text-ink-3">
          Verde: la meta pide crecer 15% o menos (o menos que este mes) · ámbar: 15% a 40% · rojo: más de 40%. Los clientes nuevos se muestran sin comparación porque la hoja METAS no indica a qué línea corresponden.
        </p>
      </motion.section>

      {session.analysis.insights.some((i) => i.tags.includes('Metas')) && (
        <motion.section variants={fadeUp}>
          <Card className="flex items-start gap-3 border-l-4 border-l-crit px-4.5 py-3.5">
            <Pill className="bg-crit-bg text-crit-ink">Atención</Pill>
            <p className="text-[13.5px] text-ink-2">{session.analysis.insights.find((i) => i.tags.includes('Metas'))!.body}</p>
          </Card>
        </motion.section>
      )}
    </motion.div>
  );
}
