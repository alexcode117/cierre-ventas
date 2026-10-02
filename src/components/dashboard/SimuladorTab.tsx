'use client';

import clsx from 'clsx';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowRight, RotateCcw, Wand2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { itemMax, meetsTarget } from '@/lib/analysis';
import { rulePoints, RULES_TEXT, thresholdOf } from '@/lib/rules';
import { band, fmt, prettyItem, statusOf } from '@/lib/format';
import type { Session } from '@/lib/load';
import type { Line } from '@/lib/types';
import { Button, Card, CountUp, SectionHead, Segmented, StatusPill } from '../ui';

const lineColor = (l: Line) => (l === 'Pegutil' ? 'var(--peg)' : 'var(--pru)');

export default function SimuladorTab({ session, seller, onSeller }: { session: Session; seller: number; onSeller: (i: number) => void }) {
  const d = session.cur.report;
  const s = d.sellers[seller] ?? d.sellers[0];
  const [sim, setSim] = useState<Record<string, number>>({});
  // 'excel': respeta los puntos del Excel en lo que no se ha movido. 'regla': recalcula todo con la regla.
  const [basis, setBasis] = useState<'excel' | 'regla'>('excel');

  const res = useMemo(() => s?.blocks.map((b, bi) => {
    let score = 0;
    const items = b.items.map((it, ii) => {
      const k = `${bi}:${ii}`;
      const real = sim[k] ?? it.real ?? 0;
      const pct = it.obj ? (real / it.obj) * 100 : it.pct ?? 0;
      const changed = sim[k] != null && sim[k] !== it.real;
      const pts = changed || basis === 'regla' ? (meetsTarget(it, pct) ? itemMax(b, it) : 0) : it.pts;
      const offRule = it.pct != null && rulePoints(b, it) !== it.pts;
      score += pts;
      return { it, k, real, pct, pts, changed, offRule };
    });
    return { b, items, score, status: statusOf(score) };
  }) ?? [], [s, sim, basis]);

  if (!s) return <p className="text-ink-2">El archivo no tiene hojas de vendedor.</p>;
  const offRuleCount = res.reduce((a, r) => a + r.items.filter((x) => x.offRule).length, 0);
  const base = s.blocks.reduce((a, b) => a + b.score, 0);
  const now = res.reduce((a, r) => a + r.score, 0);
  const changed = Object.keys(sim).filter((k) => res.some((r) => r.items.some((x) => x.k === k && x.changed))).length;

  function closeNear() {
    const next: Record<string, number> = {};
    s.blocks.forEach((b, bi) => b.items.forEach((it, ii) => {
      if (!it.ok && it.pct != null && it.pct >= 70 && it.obj) next[`${bi}:${ii}`] = /COBRANZA/i.test(it.name) ? Math.ceil(it.obj * 90) / 100 : it.obj;
    }));
    setSim(next);
  }

  return (
    <div className="grid gap-4">
      <SectionHead title="Simulador: ¿qué pasa si…?" sub="Mueva el resultado de cada indicador y vea cómo cambian el puntaje y el estado.">
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="sim-seller" className="text-[13px] text-ink-2">Vendedor</label>
          <select id="sim-seller" value={seller} onChange={(e) => { onSeller(+e.target.value); setSim({}); }} className="rounded-lg border border-line bg-panel px-2.5 py-2 text-[14px]">
            {d.sellers.map((x, i) => <option key={x.sheet} value={i}>{x.display}</option>)}
          </select>
          <Button onClick={closeNear}><Wand2 size={15} aria-hidden />Cerrar casi-logros</Button>
          <Button onClick={() => setSim({})} disabled={!changed}><RotateCcw size={15} aria-hidden />Restablecer</Button>
        </div>
      </SectionHead>

      <Card className="flex flex-wrap items-center justify-between gap-3 px-4.5 py-3">
        <div className="min-w-0 text-[13px] text-ink-2">
          <b className="font-semibold text-ink">Punto de partida.</b> {RULES_TEXT}
          {offRuleCount > 0 && <span className="text-warn-ink"> En {s.display.split(' ')[0]}, {offRuleCount} {offRuleCount === 1 ? 'indicador tiene' : 'indicadores tienen'} puntos del Excel que no siguen esta regla (marcados abajo).</span>}
        </div>
        <Segmented label="Punto de partida" value={basis} onChange={setBasis} options={[['excel', 'Puntos del Excel'], ['regla', 'Aplicar la regla a todo']]} />
      </Card>

      <div className="grid items-start gap-3 lg:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          {res.map((r) => (
            <div key={r.b.line}>
              <h3 className="flex items-baseline justify-between gap-2.5 px-4.5 pt-3.5 pb-1.5 font-bold">
                <span className="inline-flex items-center gap-2"><i className="size-2.5 rounded-sm" style={{ background: lineColor(r.b.line) }} />{r.b.line}</span>
                <span className="text-[13px] font-normal text-ink-2">{fmt(r.score, 1)} / 12</span>
              </h3>
              {r.items.map((x) => {
                const ratio = (x.it.obj ?? 0) <= 1;
                const obj = x.it.obj ?? 0;
                const max = Math.max(obj * 1.6, (x.it.real ?? 0) * 1.1, ratio ? 1 : 1);
                const step = ratio ? 0.01 : obj >= 200 ? 1 : obj >= 20 ? 0.5 : 1;
                const show = (v: number) => (ratio ? `${fmt(v * 100)}%` : fmt(v, 1));
                const bd = band(x.pct);
                return (
                  <div key={x.k} className={clsx('grid grid-cols-[1fr_70px_56px] items-center gap-x-3 gap-y-1 border-t border-line-2 px-4.5 py-2 text-[13.5px] transition-colors sm:grid-cols-[minmax(130px,1.1fr)_minmax(120px,1.4fr)_84px_62px]', x.changed && 'bg-accent-soft')}>
                    <label htmlFor={`sim-${x.k}`} className="min-w-0">{prettyItem(x.it.name)}<small className="block text-[11.5px] text-ink-3">Objetivo {show(obj)} · real {show(x.it.real ?? 0)}</small>
                      {x.offRule && <small className="mt-0.5 block text-[11.5px] font-medium text-warn-ink">El Excel le da {fmt(x.it.pts, 1)} pts con {fmt(x.it.pct, 1)}% (la regla pide {thresholdOf(x.it)}%)</small>}</label>
                    <input id={`sim-${x.k}`} type="range" min={0} max={max} step={step} value={x.real} onChange={(e) => setSim({ ...sim, [x.k]: +e.target.value })}
                      className="col-span-3 row-start-2 w-full sm:col-span-1 sm:row-start-auto" />
                    <span className="text-right font-semibold">{show(x.real)}<small className={clsx('block text-[11.5px] font-medium', bd === 'good' ? 'text-good-ink' : bd === 'crit' ? 'text-crit-ink' : 'text-warn-ink')}>{fmt(x.pct)}%</small></span>
                    <motion.span key={x.pts} initial={{ scale: 1.25 }} animate={{ scale: 1 }} className={clsx('text-right font-bold', x.pts > 0 ? 'text-good-ink' : 'text-crit-ink')}>{fmt(x.pts, 1)} pts</motion.span>
                  </div>
                );
              })}
            </div>
          ))}
        </Card>

        <Card className="grid gap-3.5 px-5 py-4.5 lg:sticky lg:top-16">
          <span className="eyebrow">Puntaje total de {s.display}</span>
          <div className="flex items-baseline gap-2">
            <span className="display text-[46px] leading-none font-extrabold">{fmt(base, 1)}</span>
            <ArrowRight className="text-ink-3" size={22} aria-hidden />
            <span className={clsx('display text-[46px] leading-none font-extrabold', now > base ? 'text-good-ink' : now < base ? 'text-crit-ink' : '')}><CountUp key={now} value={now} digits={1} /></span>
            <span className="text-base text-ink-3">/ 24</span>
          </div>
          {res.map((r) => (
            <div key={r.b.line} className="grid gap-1.5">
              <div className="grid grid-cols-[58px_1fr_auto] items-center gap-2.5 text-[13px]">
                <span className="text-ink-2">{r.b.line}</span>
                <span className="relative h-2.5 rounded-full bg-track">
                  <motion.i className="absolute inset-y-0 left-0 rounded-full" style={{ background: lineColor(r.b.line) }} animate={{ width: `${(r.score / 12) * 100}%` }} transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }} />
                  <span className="absolute -top-[3px] -bottom-[3px] w-[1.5px] bg-ink-3" style={{ left: `${(10 / 12) * 100}%` }} />
                </span>
                <span className="font-semibold">{fmt(r.score, 1)}<span className="font-normal text-ink-3">/12</span></span>
              </div>
              <div className="flex items-center gap-2 pl-[68px]">
                <StatusPill s={r.b.status} />
                <AnimatePresence>
                  {r.status !== r.b.status && (
                    <motion.span initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="inline-flex items-center gap-2">
                      <ArrowRight size={14} className="text-ink-3" aria-hidden /><StatusPill s={r.status} />
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          ))}
          <p className="text-[12.5px] text-ink-2">
            {changed ? `${changed} indicador${changed > 1 ? 'es' : ''} modificado${changed > 1 ? 's' : ''}. ` : ''}
            {basis === 'excel' ? 'Parte de los puntos del Excel; lo que mueva se recalcula con la regla.' : 'Todos los indicadores se recalculan con la regla.'} Ventas Pruven valen 0,5 pts; los demás indicadores, 3 pts.
          </p>
        </Card>
      </div>
    </div>
  );
}
