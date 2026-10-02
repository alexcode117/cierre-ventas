'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Info, TrendingUp, X } from 'lucide-react';
import { fmt, STATUS_LABEL, titleCase } from '@/lib/format';
import type { TeamMetric } from '@/lib/analysis';
import type { Session } from '@/lib/load';
import type { Insight, Status } from '@/lib/types';
import { DumbbellChart, PointLossChart } from '../charts/charts';
import { Card, CountUp, Delta, fadeUp, Meter, SectionHead, stagger, StatusPill } from '../ui';
import type { TabKey } from './Dashboard';

const SEV = {
  crit: { border: 'border-l-crit', icon: <X size={14} />, chip: 'bg-crit-bg text-crit-ink' },
  warn: { border: 'border-l-warn', icon: <AlertTriangle size={14} />, chip: 'bg-warn-bg text-warn-ink' },
  good: { border: 'border-l-good', icon: <TrendingUp size={14} />, chip: 'bg-good-bg text-good-ink' },
  info: { border: 'border-l-accent', icon: <Info size={14} />, chip: 'bg-accent-soft text-accent' },
} as const;

export function InsightCard({ i }: { i: Insight }) {
  const s = SEV[i.sev];
  return (
    <motion.article variants={fadeUp} className={clsx('grid grid-cols-[28px_1fr] gap-x-2.5 gap-y-1 rounded-xl border border-l-4 border-line bg-panel py-3.5 pr-4 pl-3.5', s.border)}>
      <span className={clsx('row-span-3 grid size-[26px] place-items-center rounded-full', s.chip)} aria-hidden>{s.icon}</span>
      <h4 className="display text-[15.5px] leading-tight font-bold" style={{ fontStretch: '90%' }}>{i.title}</h4>
      <p className="text-[13.5px] leading-snug text-ink-2">{i.body}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {i.tags.map((t) => <span key={t} className="rounded border border-line px-1.5 font-mono text-[10.5px] text-ink-3">{t}</span>)}
      </div>
    </motion.article>
  );
}

export default function ResumenTab({ session, onGo }: { session: Session; onGo: (t: TabKey) => void }) {
  const { cur, analysis: a, comparison: c } = session;
  const d = cur.report;
  const count = (s: Status) => d.sellers.filter((x) => x.status === s).length;
  const insights = session.insights;
  const prevLabel = c ? titleCase(c.prevMonth.replace(/\s*20\d\d/, '')) : '';
  const curLabel = titleCase((d.month ?? 'Este mes').replace(/\s*20\d\d/, ''));

  return (
    <div className="grid gap-7">
      <motion.section variants={stagger} initial="hidden" animate="show" className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Resumen del mes">
        <Kpi label="Pegutil · sacos" m={a.team.sacos} unit="sacos"
          delta={c && <Delta cur={c.team.sacos.cur} prev={c.team.sacos.prev} pct label={`${a.team.sacos.excluded.length ? 'del total ' : ''}vs ${prevLabel.toLowerCase()}`} />} />
        <Kpi label="Pruven · galones" m={a.team.galones} unit="gal"
          delta={c && <Delta cur={c.team.galones.cur} prev={c.team.galones.prev} pct label={`${a.team.galones.excluded.length ? 'del total ' : ''}vs ${prevLabel.toLowerCase()}`} />} />
        <motion.div variants={fadeUp}>
          <Card className="grid h-full content-start gap-2 px-4.5 py-4">
            <span className="eyebrow">Puntaje promedio</span>
            <div className="display text-[34px] leading-none font-extrabold"><CountUp value={a.avgScore} digits={1} /><small className="ml-1.5 font-sans text-sm font-medium text-ink-3">/ 24</small></div>
            <div className="flex flex-wrap gap-1.5">
              {(['PRODUCTIVO', 'ESTABLE', 'CRITICO'] as const).map((s) => <StatusPill key={s} s={s}>{count(s)} {STATUS_LABEL[s].toLowerCase()}</StatusPill>)}
            </div>
            {c && <Delta cur={c.team.avgScore.cur} prev={c.team.avgScore.prev} digits={1} suffix=" pts" label={`vs ${prevLabel.toLowerCase()}`} />}
          </Card>
        </motion.div>
        <motion.div variants={fadeUp}>
          <Card className="grid h-full content-start gap-2 px-4.5 py-4">
            <span className="eyebrow">Venta cruzada</span>
            <div className="display text-[34px] leading-none font-extrabold"><CountUp value={a.teamCross} digits={1} /><small className="ml-1.5 font-sans text-sm font-medium text-ink-3">gal / 100 sacos</small></div>
            <p className="text-[13px] text-ink-2">Galones Pruven vendidos por cada 100 sacos Pegutil.</p>
          </Card>
        </motion.div>
      </motion.section>

      <section className="grid gap-3">
        <SectionHead title="Hallazgos del mes" sub={`${insights.length} hallazgos calculados a partir de los datos, ordenados por prioridad`} />
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-2.5 md:grid-cols-2">
          {insights.map((i) => <InsightCard key={i.title} i={i} />)}
        </motion.div>
      </section>

      {c && c.sellers.size > 0 && (
        <section className="grid gap-3">
          <SectionHead title={`Puntaje: ${prevLabel.toLowerCase()} → ${curLabel.toLowerCase()}`} sub="Línea verde: subió · roja: bajó (máximo 24 puntos)" />
          <Card className="px-4 py-3">
            <DumbbellChart prevLabel={prevLabel} curLabel={curLabel} rows={[...c.sellers.values()].sort((x, y) => y.total - x.total).map((s) => ({ name: s.display, prev: s.prevTotal, cur: s.total }))} />
          </Card>
        </section>
      )}

      <section className="grid items-start gap-3 lg:grid-cols-[1.25fr_1fr]">
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
                  <span className="text-[14px] font-semibold">{n.seller} <span className="font-normal text-ink-2">· {n.name} ({n.line})</span></span>
                  <span className="row-span-2 text-right text-[15px] font-bold text-good-ink">+{fmt(n.gain, 1)} pts{n.to !== n.from && <small className="block text-[11.5px] font-medium">→ {STATUS_LABEL[n.to].toLowerCase()}</small>}</span>
                  <span className="text-[13px] text-ink-2">Está al {fmt(n.pct)}% · faltan {n.needText}</span>
                </li>
              ))}
              {!a.nearMiss.length && <li className="px-4.5 py-3 text-[13px] text-ink-2">No hay indicadores cerca de cumplirse.</li>}
            </ul>
            <div className="border-t border-line-2 px-4.5 py-3">
              <button onClick={() => onGo('simulador')} className="inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-accent hover:underline">Probar escenarios en el simulador <ArrowRight size={14} aria-hidden /></button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, m, unit, delta }: { label: string; m: TeamMetric; unit: string; delta?: React.ReactNode }) {
  const { sold: value, meta, pct } = m;
  return (
    <motion.div variants={fadeUp}>
      <Card className="grid h-full content-start gap-2 px-4.5 py-4">
        <span className="eyebrow">{label}</span>
        <div className="display text-[34px] leading-none font-extrabold"><CountUp value={value} /><small className="ml-1.5 font-sans text-sm font-medium text-ink-3">/ {fmt(meta)}</small></div>
        <Meter pct={pct} />
        <div className="text-[13px] text-ink-2">{fmt(pct, 1)}% de la meta</div>
        {m.excluded.length > 0 && (
          <p className="text-[12px] leading-snug text-ink-3">
            Sin contar {m.excluded.map((z) => `${z.vendedor && z.vendedor !== '-' ? z.vendedor : z.zona} (${fmt(z.value)} ${unit})`).join(', ')}: no {m.excluded.length > 1 ? 'tienen' : 'tiene'} meta individual. Total vendido: {fmt(m.total)} {unit}.
          </p>
        )}
        {delta}
      </Card>
    </motion.div>
  );
}
