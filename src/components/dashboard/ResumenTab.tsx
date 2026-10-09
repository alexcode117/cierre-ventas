'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Info, TrendingUp, X } from 'lucide-react';
import { fmt, STATUS_LABEL, titleCase } from '@/lib/format';
import type { TeamMetric } from '@/lib/analysis';
import type { Session } from '@/lib/load';
import type { Insight, Status } from '@/lib/types';
import { DumbbellChart, PointLossChart } from '../charts/charts';
import { Card, CountUp, Delta, SectionHead } from '../ui';
import type { TabKey } from './Dashboard';

const SEV = {
  crit: { label: 'Atender primero', icon: <X size={13} strokeWidth={2.5} />, chip: 'bg-crit text-white', rule: 'bg-crit' },
  warn: { label: 'Revisar', icon: <AlertTriangle size={13} strokeWidth={2.5} />, chip: 'bg-warn text-white', rule: 'bg-warn' },
  good: { label: 'Va bien', icon: <TrendingUp size={13} strokeWidth={2.5} />, chip: 'bg-good text-white', rule: 'bg-good' },
  info: { label: 'Para tener en cuenta', icon: <Info size={13} strokeWidth={2.5} />, chip: 'bg-ink-3 text-white', rule: 'bg-ink-3' },
} as const;
const SEV_ORDER = ['crit', 'warn', 'good', 'info'] as const;
const STATUS_TILE: Record<Status, string> = { PRODUCTIVO: 'bg-good', ESTABLE: 'bg-warn', CRITICO: 'bg-crit' };
const EASE = [0.16, 1, 0.3, 1] as const;

function InsightRow({ i }: { i: Insight }) {
  return (
    <li className="grid gap-1 border-t border-line-2 px-4.5 py-3.5 first:border-t-0">
      <h4 className="text-[15px] leading-snug font-semibold">{i.title}</h4>
      <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-ink-2">{i.body}</p>
      {i.tags.length > 0 && (
        <div className="mt-0.5 flex flex-wrap gap-1.5">
          {i.tags.map((t) => <span key={t} className="rounded-full bg-panel-2 px-2 py-px text-[11.5px] font-medium text-ink-3">{t}</span>)}
        </div>
      )}
    </li>
  );
}

export default function ResumenTab({ session, onGo }: { session: Session; onGo: (t: TabKey) => void }) {
  const { cur, analysis: a, comparison: c } = session;
  const d = cur.report;
  const count = (s: Status) => d.sellers.filter((x) => x.status === s).length;
  const insights = session.insights;
  const prevLabel = c ? titleCase(c.prevMonth.replace(/\s*20\d\d/, '')) : '';
  const curLabel = titleCase((d.month ?? 'Este mes').replace(/\s*20\d\d/, ''));
  const vsPrev = (m: TeamMetric) => `${m.excluded.length ? 'del total ' : ''}vs ${prevLabel.toLowerCase()}`;
  const groups = SEV_ORDER.map((sev) => ({ sev, items: insights.filter((i) => i.sev === sev) })).filter((g) => g.items.length);
  // La cinta llega hasta el mayor % del mes (mínimo 150%), en tramos de 10%.
  const tapeMax = Math.min(250, Math.max(150, Math.ceil(Math.max(a.team.sacos.pct ?? 0, a.team.galones.pct ?? 0) / 10) * 10 + 10));

  return (
    <div className="grid gap-9">
      <section aria-label="Resumen del mes">
        <Card className="grid overflow-hidden lg:grid-cols-[1fr_300px]">
          <div className="grid">
            <TapeRow line="Pegutil" unit="sacos" m={a.team.sacos} max={tapeMax} delay={0}
              delta={c && <Delta cur={c.team.sacos.cur} prev={c.team.sacos.prev} pct label={vsPrev(a.team.sacos)} />} />
            <TapeRow line="Pruven" unit="galones" m={a.team.galones} max={tapeMax} delay={0.15}
              delta={c && <Delta cur={c.team.galones.cur} prev={c.team.galones.prev} pct label={vsPrev(a.team.galones)} />} />
          </div>
          <div className="grid content-start gap-3 border-t border-line bg-panel-2 px-5 py-5 lg:border-t-0 lg:border-l">
            <span className="text-[13px] font-semibold text-ink-2">Puntaje promedio del equipo</span>
            <div className="display text-[56px] leading-[0.9] font-extrabold">
              <CountUp value={a.avgScore} digits={1} /><span className="ml-1.5 text-[22px] font-bold text-ink-3">de 24</span>
            </div>
            {c && <Delta cur={c.team.avgScore.cur} prev={c.team.avgScore.prev} digits={1} suffix=" pts" label={`vs ${prevLabel.toLowerCase()}`} />}
            {/* Un azulejo por vendedor, del color de su estado. */}
            <div className="mt-1 flex flex-wrap gap-[3px] rounded-md bg-grout p-[3px]" role="img" aria-label={`${count('PRODUCTIVO')} productivos, ${count('ESTABLE')} estables, ${count('CRITICO')} críticos`}>
              {(['PRODUCTIVO', 'ESTABLE', 'CRITICO'] as const).flatMap((s) => d.sellers.filter((x) => x.status === s).map((x) => (
                <span key={x.sheet} title={`${x.display}: ${STATUS_LABEL[s]}`} className={clsx('h-7 min-w-7 flex-1 rounded-[3px]', STATUS_TILE[s])} />
              )))}
            </div>
            <ul className="grid gap-1 text-[13.5px]">
              {(['PRODUCTIVO', 'ESTABLE', 'CRITICO'] as const).map((s) => (
                <li key={s} className="flex items-center gap-2">
                  <i className={clsx('size-2.5 rounded-[2px]', STATUS_TILE[s])} aria-hidden />
                  {STATUS_LABEL[s]}<b className="ml-auto font-semibold">{count(s)}</b>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </section>

      <section className="grid gap-3">
        <SectionHead title="Hallazgos del mes" sub={`${insights.length} hallazgos calculados a partir de los datos, agrupados por prioridad`} />
        <div className="gap-3 md:columns-2">
          {groups.map((g) => (
            <Card key={g.sev} className="mb-3 break-inside-avoid overflow-hidden">
              <h3 className="flex items-center gap-2.5 border-b border-line px-4.5 py-2.5 text-[14px] font-bold">
                <span className={clsx('grid size-[22px] place-items-center rounded-full', SEV[g.sev].chip)} aria-hidden>{SEV[g.sev].icon}</span>
                {SEV[g.sev].label}
                <span className="ml-auto text-[13px] font-semibold text-ink-3">{g.items.length}</span>
              </h3>
              <ul>{g.items.map((i) => <InsightRow key={i.title} i={i} />)}</ul>
            </Card>
          ))}
        </div>
      </section>

      {c && c.sellers.size > 0 && (
        <section className="grid gap-3">
          <SectionHead title={`Puntaje de ${prevLabel.toLowerCase()} a ${curLabel.toLowerCase()}`} sub="Línea verde: subió. Roja: bajó. Máximo 24 puntos." />
          <Card className="px-4 py-3">
            <DumbbellChart prevLabel={prevLabel} curLabel={curLabel} rows={[...c.sellers.values()].sort((x, y) => y.total - x.total).map((s) => ({ name: s.display, prev: s.prevTotal, cur: s.total }))} />
          </Card>
        </section>
      )}

      <section className="grid items-start gap-x-5 gap-y-9 lg:grid-cols-[1.25fr_1fr]">
        <div className="grid min-w-0 gap-3">
          <SectionHead title="¿Dónde se pierden los puntos?" sub={`${fmt(a.totalLost, 1)} pts perdidos en el equipo`} />
          <Card className="px-3 py-3"><PointLossChart data={a.pointLoss} /></Card>
        </div>
        <div className="grid min-w-0 gap-3">
          <SectionHead title="Puntos al alcance" sub="Lo que falta para cumplir cada indicador" />
          <Card>
            <ul>
              {a.nearMiss.slice(0, 6).map((n) => (
                <li key={n.seller + n.line + n.name} className="grid grid-cols-[1fr_auto] items-center gap-x-3.5 gap-y-0.5 border-b border-line-2 px-4.5 py-3 last:border-b-0">
                  <span className="text-[14px] font-semibold">{n.seller}<span className="block text-[13px] font-normal text-ink-2">{n.name}, {n.line}</span></span>
                  <span className="row-span-2 text-right">
                    <span className="display text-[24px] leading-none font-extrabold text-good-ink">+{fmt(n.gain, 1)}</span>
                    <span className="ml-0.5 text-[12px] font-semibold text-good-ink">pts</span>
                    {n.to !== n.from && <small className="block text-[11.5px] font-semibold text-good-ink">pasa a {STATUS_LABEL[n.to].toLowerCase()}</small>}
                  </span>
                  <span className="text-[13px] text-ink-3">Está al {fmt(n.pct)}%; faltan {n.needText}</span>
                </li>
              ))}
              {!a.nearMiss.length && <li className="px-4.5 py-3 text-[13px] text-ink-2">No hay indicadores cerca de cumplirse.</li>}
            </ul>
            <div className="border-t border-line px-4.5 py-3">
              <button onClick={() => onGo('simulador')} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 hover:decoration-ink">
                Probar escenarios en el simulador <ArrowRight size={14} aria-hidden />
              </button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

/** Una línea de la cinta de metas: lo vendido sobre una regla graduada en % de la meta, con la meta marcada en 100%. */
function TapeRow({ line, unit, m, max, delay, delta }: { line: 'Pegutil' | 'Pruven'; unit: string; m: TeamMetric; max: number; delay: number; delta?: React.ReactNode }) {
  const { sold, meta, pct } = m;
  const color = line === 'Pegutil' ? 'var(--peg)' : 'var(--pru)';
  const at = (p: number) => `${(p / max) * 100}%`;
  const ticks = Array.from({ length: max / 10 + 1 }, (_, i) => i * 10);
  const met = (pct ?? 0) >= 100;
  return (
    <div className="grid gap-x-6 gap-y-4 border-b border-line px-5 py-5 last:border-b-0 sm:grid-cols-[190px_1fr]">
      <div className="grid content-start gap-1">
        <span className="flex items-center gap-2 text-[13px] font-semibold text-ink-2">
          <i className="size-2.5 rounded-[2px]" style={{ background: color }} aria-hidden />{line}, {unit}
        </span>
        <div className="display text-[48px] leading-[0.9] font-extrabold"><CountUp value={sold} /></div>
        <span className="text-[13px] text-ink-2">de una meta de {fmt(meta)}</span>
        {delta}
      </div>
      <div className="grid content-center gap-2">
        <div className="relative pt-7 pb-6" role="img" aria-label={`${line}: ${fmt(pct, 1)}% de la meta`}>
          {/* % logrado, sobre el final de la barra */}
          <motion.span className={clsx('absolute top-0 -translate-x-1/2 display text-[22px] leading-none font-extrabold', met ? 'text-good-ink' : 'text-crit-ink')}
            initial={{ left: '0%', opacity: 0 }} animate={{ left: at(Math.min(pct ?? 0, max)), opacity: 1 }} transition={{ duration: 1.1, delay, ease: EASE }}>
            {fmt(pct, 1)}%
          </motion.span>
          <div className="relative h-9 overflow-hidden rounded-[4px] border border-line bg-panel-2">
            {/* Graduación cada 10%, más larga cada 50% */}
            {ticks.map((t) => (
              <span key={t} className={clsx('absolute top-0 w-px bg-ink-3', t % 50 === 0 ? 'h-3.5 opacity-70' : 'h-2 opacity-40')} style={{ left: at(t) }} aria-hidden />
            ))}
            <motion.div className="absolute inset-y-[9px] left-0 rounded-r-[3px]" style={{ background: color }}
              initial={{ width: '0%' }} animate={{ width: at(Math.min(pct ?? 0, max)) }} transition={{ duration: 1.1, delay, ease: EASE }} />
          </div>
          {/* Meta en 100% */}
          <span className="absolute top-5 bottom-4 w-[2px] -translate-x-1/2 bg-ink" style={{ left: at(100) }} aria-hidden />
          {ticks.filter((t) => t % 50 === 0).map((t) => (
            <span key={t} className={clsx('absolute bottom-0 -translate-x-1/2 text-[11.5px]', t === 100 ? 'font-bold text-ink' : 'text-ink-3', t === 0 && 'translate-x-0', t === max && '-translate-x-full')} style={{ left: at(t) }}>
              {t === 100 ? 'Meta' : `${t}%`}
            </span>
          ))}
        </div>
        {m.excluded.length > 0 && (
          <p className="text-[12.5px] leading-snug text-ink-3">
            Sin contar {m.excluded.map((z) => `${z.vendedor && z.vendedor !== '-' ? z.vendedor : z.zona} (${fmt(z.value)} ${unit})`).join(', ')}: no {m.excluded.length > 1 ? 'tienen' : 'tiene'} meta individual. Total vendido: {fmt(m.total)} {unit}.
          </p>
        )}
      </div>
    </div>
  );
}
