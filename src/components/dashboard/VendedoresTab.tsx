'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { AlertOctagon, AlertTriangle, Check, Info, Minus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { itemMax } from '@/lib/analysis';
import { prevItem } from '@/lib/compare';
import { fmt, itemBand, prettyItem, STATUS_LABEL } from '@/lib/format';
import { nextStep, STATUS_THRESHOLDS } from '@/lib/rules';
import type { Session } from '@/lib/load';
import type { Line, Seller } from '@/lib/types';
import { Button, Card, Delta, fadeUp, SectionHead, Segmented, stagger, StatusPill } from '../ui';

type LineFilter = 'all' | Line;
type HeatMode = 'pct' | 'gap' | 'pts' | 'delta';

const BAND_CLS = { good: 'bg-good-bg text-good-ink', warn: 'bg-warn-bg text-warn-ink', crit: 'bg-crit-bg text-crit-ink', none: 'text-ink-3 font-normal' };
const BAND_ICON = { good: <Check size={13} strokeWidth={3} />, warn: <Minus size={13} strokeWidth={3} />, crit: <X size={13} strokeWidth={3} />, none: null };
const lineColor = (l: Line) => (l === 'Pegutil' ? 'var(--peg)' : 'var(--pru)');

export default function VendedoresTab({ session, onSimulate }: { session: Session; onSimulate: (i: number) => void }) {
  const { cur, comparison: c } = session;
  const d = cur.report;
  const [line, setLine] = useState<LineFilter>('all');
  const [mode, setMode] = useState<HeatMode>('pct');
  const [focus, setFocus] = useState<string | null>(null);
  const [detail, setDetail] = useState<number | null>(null);
  const dlg = useRef<HTMLDialogElement>(null);
  const lines: Line[] = line === 'all' ? ['Pegutil', 'Pruven'] : [line];
  const zonaOf = (s: Seller) => d.results?.zonas.find((z) => z.sheet === s.sheet);
  const modes: [HeatMode, string][] = [['pct', '% de la meta'], ['gap', 'Lo que falta'], ['pts', 'Puntos'], ...(c ? [['delta', 'Cambio vs anterior'] as [HeatMode, string]] : [])];

  const open = (i: number) => { setDetail(i); requestAnimationFrame(() => dlg.current?.showModal()); };

  return (
    <div className="grid gap-7">
      <section className="grid gap-3">
        <SectionHead title="Ranking de vendedores" sub="Ordenado por puntaje total (Pegutil + Pruven, máx. 24). Haga clic en una tarjeta para resaltarla en el mapa.">
          <Segmented label="Línea" value={line} onChange={setLine} options={[['all', 'Ambas líneas'], ['Pegutil', 'Pegutil'], ['Pruven', 'Pruven']]} />
        </SectionHead>
        <motion.div variants={stagger} initial="hidden" animate="show" className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-3">
          {d.sellers.map((s, i) => {
            const z = zonaOf(s);
            // Las tarjetas usan la hoja del vendedor (la misma fuente de sus puntos y del mapa); si RESULTADOS dice otra cosa, se indica.
            const sacos = s.sacos.real ?? z?.sacos ?? null, gal = s.galones.real ?? z?.galones ?? null;
            const sp = s.sacos.meta && sacos != null ? (sacos / s.sacos.meta) * 100 : null;
            const gp = s.galones.meta && gal != null ? (gal / s.galones.meta) * 100 : null;
            const cd = c?.sellers.get(s.sheet);
            return (
              <motion.article key={s.sheet} variants={fadeUp} onClick={() => setFocus(focus === s.sheet ? null : s.sheet)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setFocus(focus === s.sheet ? null : s.sheet))}
                tabIndex={0} aria-pressed={focus === s.sheet}
                className={clsx('relative grid cursor-pointer content-start gap-3.5 overflow-hidden rounded-lg border bg-panel px-4.5 pt-5 pb-4 transition-colors',
                  focus === s.sheet ? 'border-ink ring-2 ring-ink' : 'border-line hover:border-ink-3')}>
                <span className={clsx('absolute inset-x-0 top-0 h-1.5', s.status === 'PRODUCTIVO' ? 'bg-good' : s.status === 'ESTABLE' ? 'bg-warn' : 'bg-crit')} aria-hidden />
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="display text-[40px] leading-[0.8] font-extrabold text-ink-3" aria-label={`Puesto ${i + 1}`}>{i + 1}</span>
                    <div className="min-w-0">
                      <h3 className="display text-[22px] leading-[1.05] font-extrabold">{s.display}</h3>
                      <div className="text-[12.5px] text-ink-3">{s.zona}</div>
                    </div>
                  </div>
                  <div className="grid justify-items-end gap-1">
                    <StatusPill s={s.status} />
                    {cd && cd.prevStatus !== s.status && <span className="text-[11.5px] text-ink-3">antes {STATUS_LABEL[cd.prevStatus].toLowerCase()}</span>}
                  </div>
                </div>
                <div className="grid gap-2.5">
                  {s.blocks.filter((b) => lines.includes(b.line)).map((b) => {
                    const prev = cd?.lines.find((l) => l.line === b.line)?.prev;
                    return (
                      <div key={b.line} className="grid grid-cols-[58px_1fr_auto] items-center gap-2.5 text-[13px]">
                        <span className="text-ink-2">{b.line}</span>
                        <span className="relative h-2.5 rounded-full bg-track">
                          <motion.i className="absolute inset-y-0 left-0 rounded-full" style={{ background: lineColor(b.line) }} initial={{ width: 0 }} animate={{ width: `${(b.score / 12) * 100}%` }} transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.16, 1, 0.3, 1] }} />
                          {prev != null && <span title={`Mes anterior: ${fmt(prev, 1)}`} className="absolute -top-[3px] size-4 -translate-x-1/2 rounded-full border-2 border-panel bg-ink-3/70" style={{ left: `${(prev / 12) * 100}%` }} />}
                          <span className="absolute -top-[3px] -bottom-[3px] w-[1.5px] bg-ink-3" style={{ left: `${(STATUS_THRESHOLDS[session.basis].productivo / 12) * 100}%` }} />
                        </span>
                        <span className="min-w-[50px] text-right font-semibold">{fmt(b.score, 1)}<span className="font-normal text-ink-3">/12</span></span>
                      </div>
                    );
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2.5 border-t border-line-2 pt-3">
                  {line !== 'Pruven' && <MiniStat label="Sacos" value={sacos} pct={sp} meta={s.sacos.meta} prev={cd?.sacos.prev} other={z?.sacos} />}
                  {line !== 'Pegutil' && <MiniStat label="Galones" value={gal} pct={gp} meta={s.galones.meta} prev={cd?.galones.prev} other={z?.galones} />}
                </div>
                <Button className="justify-self-start" onClick={(e) => { e.stopPropagation(); open(i); }}>Ver detalle</Button>
              </motion.article>
            );
          })}
        </motion.div>
      </section>

      <section className="grid gap-3">
        <SectionHead title="Mapa de cumplimiento" sub="Cada azulejo es un indicador de un vendedor. Pase el cursor para ver objetivo y real.">
          <Segmented label="Mostrar" value={mode} onChange={setMode} options={modes} />
        </SectionHead>
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr className="border-b border-line">
                  <th className="py-2.5 pr-3 pl-4 text-left font-semibold">Indicador</th>
                  {d.sellers.map((s) => (
                    <th key={s.sheet} className={clsx('cursor-pointer px-1.5 py-2.5 text-center font-semibold', focus === s.sheet && 'text-accent')} onClick={() => setFocus(focus === s.sheet ? null : s.sheet)}>
                      {s.display.split(' ')[0]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((ln) => {
                  const ref = d.sellers.map((s) => s.blocks.find((b) => b.line === ln)).find(Boolean);
                  if (!ref) return null;
                  return [
                    <tr key={ln + '-h'}>
                      <th colSpan={d.sellers.length + 1} className="px-4 pt-5 pb-1.5 text-left text-[13px] font-bold text-ink">
                        <i className="mr-1.5 inline-block size-[9px] rounded-sm" style={{ background: lineColor(ln) }} />{ln}
                      </th>
                    </tr>,
                    ...ref.items.map((it, k) => (
                      <tr key={ln + it.name} className="border-b border-line-2">
                        <th className="py-1 pr-3 pl-4 text-left font-medium whitespace-nowrap">{prettyItem(it.name)}</th>
                        {d.sellers.map((s) => {
                          const b = s.blocks.find((x) => x.line === ln);
                          const x = b && (b.items.find((y) => y.name === it.name) ?? b.items[k]);
                          const dim = focus && focus !== s.sheet;
                          if (!b || !x) return <td key={s.sheet}><div className="m-[2px] text-center text-ink-3">—</div></td>;
                          const bd = itemBand(x);
                          const p = prevItem(c, s.sheet, ln, x.name);
                          let txt: React.ReactNode;
                          if (mode === 'pct') txt = <>{BAND_ICON[bd]}{fmt(x.pct)}%</>;
                          else if (mode === 'pts') txt = `${fmt(x.pts, 1)} / ${fmt(itemMax(b, x), 1)}`;
                          else if (mode === 'delta') txt = p?.pct != null && x.pct != null ? `${x.pct >= p.pct ? '▲' : '▼'} ${fmt(Math.abs(x.pct - p.pct))} pp` : '—';
                          else {
                            // Lo que falta para el siguiente tramo de puntos (o para cumplir, con la base Excel).
                            const step = nextStep(b, x);
                            const g = step ? ((x.obj ?? 0) * step.pct) / 100 - (x.real ?? 0) : 0;
                            txt = !step || g <= 0 ? <>{BAND_ICON.good}{x.kpi === 'PROD' ? 'informativo' : 'cumplido'}</> : (x.obj ?? 0) <= 1 ? `faltan ${fmt(g * 100)} pp` : `faltan ${fmt(g, 1)}`;
                          }
                          const cls = mode === 'delta' && p?.pct != null && x.pct != null ? (x.pct >= p.pct ? BAND_CLS.good : BAND_CLS.crit) : BAND_CLS[bd];
                          return (
                            <td key={s.sheet} className={clsx('transition-opacity', dim && 'opacity-30')}>
                              <div title={`${s.display} · ${prettyItem(x.name)}\nObjetivo ${fmt(x.obj, 2)} · Real ${fmt(x.real, 2)} (${fmt(x.pct, 1)}%)\nCumple: ${x.ok ? 'Sí' : 'No'} · ${fmt(x.pts, 1)} pts${p ? `\nMes anterior: ${fmt(p.real, 2)} (${fmt(p.pct, 1)}%)` : ''}`}
                                className={clsx('m-[2px] flex min-w-[92px] items-center justify-center gap-1 rounded-[3px] px-2 py-2 text-[13px] font-semibold', cls)}>{txt}</div>
                            </td>
                          );
                        })}
                      </tr>
                    )),
                    <tr key={ln + '-t'} className="border-b border-line">
                      <th className="py-1 pr-3 pl-4 text-left font-bold">Puntaje {ln}</th>
                      {d.sellers.map((s) => {
                        const b = s.blocks.find((x) => x.line === ln);
                        return (
                          <td key={s.sheet} className={clsx('transition-opacity', focus && focus !== s.sheet && 'opacity-30')}>
                            <div className={clsx('m-[2px] rounded-[3px] px-2 py-2 text-center font-bold', b && (b.status === 'PRODUCTIVO' ? BAND_CLS.good : b.status === 'ESTABLE' ? BAND_CLS.warn : BAND_CLS.crit))}>{b ? `${fmt(b.score, 1)} / 12` : '—'}</div>
                          </td>
                        );
                      })}
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line px-4 py-3 text-[12.5px] text-ink-2">
            <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm bg-good-bg ring-1 ring-good" />{session.basis === 'procedimiento' ? '3 pts' : '100% o más'}</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm bg-warn-bg ring-1 ring-warn" />{session.basis === 'procedimiento' ? '1 pt' : '80 a 99%'}</span>
            <span className="inline-flex items-center gap-1.5"><i className="size-3 rounded-sm bg-crit-bg ring-1 ring-crit" />{session.basis === 'procedimiento' ? '0 pts' : 'menos de 80%'}</span>
            {session.basis === 'procedimiento' && <span>Atención de cartera: % de la cartera total (objetivo del Excel ÷ 0,7). Ventas por producto: informativas, sin puntos.</span>}
            {mode === 'delta' && <span>Verde: mejoró. Rojo: empeoró (puntos porcentuales frente al mes anterior).</span>}
          </div>
        </Card>
      </section>

      <section className="grid gap-3">
        <SectionHead title="Revisión del archivo" sub="Diferencias entre hojas que conviene corregir antes de presentar o pagar variables" />
        <Card>
          {d.alerts.length ? (
            <ul>
              {d.alerts.slice().sort((x, y) => ({ crit: 0, warn: 1, info: 2 })[x.level] - ({ crit: 0, warn: 1, info: 2 })[y.level]).map((a) => (
                <li key={a.text} className="grid grid-cols-[22px_1fr] items-start gap-2.5 border-b border-line-2 px-4.5 py-2.5 text-[14px] last:border-b-0">
                  {a.level === 'crit' ? <AlertOctagon size={18} className="mt-0.5 text-crit" aria-hidden /> : a.level === 'warn' ? <AlertTriangle size={18} className="mt-0.5 text-warn" aria-hidden /> : <Info size={18} className="mt-0.5 text-ink-3" aria-hidden />}
                  <div>
                    <span className={clsx('mr-1.5 text-[12px] font-bold', a.level === 'crit' ? 'text-crit-ink' : a.level === 'warn' ? 'text-warn-ink' : 'text-ink-3')}>{a.level === 'crit' ? 'Crítico' : a.level === 'warn' ? 'Revisar' : 'Nota'}</span>
                    {a.text}
                  </div>
                </li>
              ))}
            </ul>
          ) : <p className="px-4.5 py-3 text-[14px] text-ink-2">Las hojas cuadran entre sí.</p>}
        </Card>
      </section>

      <dialog ref={dlg} onClose={() => setDetail(null)} onClick={(e) => e.target === dlg.current && dlg.current?.close()}
        className="m-auto max-h-[calc(100dvh-48px)] w-[min(720px,calc(100vw-32px))] rounded-lg border border-line bg-panel p-0 text-ink shadow-2xl">
        {detail != null && <SellerDetail s={d.sellers[detail]} session={session} onClose={() => dlg.current?.close()} onSimulate={() => { dlg.current?.close(); onSimulate(detail); }} />}
      </dialog>
    </div>
  );
}

function MiniStat({ label, value, pct, meta, prev, other }: { label: string; value: number | null; pct: number | null; meta: number | null; prev?: number | null; other?: number | null }) {
  const differs = other != null && value != null && Math.abs(other - value) > 0.005;
  return (
    <div className="grid gap-px">
      <span className="eyebrow text-[12px]">{label}</span>
      <b className="display text-[26px] leading-none font-extrabold">{fmt(value)}</b>
      <span className={clsx('text-[12.5px]', (pct ?? 0) >= 100 ? 'text-good-ink' : 'text-crit-ink')}>{fmt(pct)}% de {fmt(meta)}</span>
      {differs && (
        <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-warn-ink" title="La hoja del vendedor y RESULTADOS no coinciden. Revise la pestaña Vendedores › Revisión del archivo.">
          <AlertTriangle size={12} aria-hidden />RESULTADOS: {fmt(other, 2)}
        </span>
      )}
      {prev != null && <Delta cur={value} prev={prev} pct label="vs ant." />}
    </div>
  );
}

function SellerDetail({ s, session, onClose, onSimulate }: { s: Seller; session: Session; onClose: () => void; onSimulate: () => void }) {
  const c = session.comparison;
  return (
    <div className="grid gap-4 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="eyebrow">{s.zona}</div>
          <h2 className="display text-[30px] leading-none font-extrabold">{s.display}</h2>
          <div className="text-[13px] text-ink-2">{s.title}</div>
        </div>
        <button onClick={onClose} aria-label="Cerrar" className="grid size-8 shrink-0 place-items-center rounded-md border border-line"><X size={16} /></button>
      </div>
      {s.blocks.map((b) => (
        <div key={b.line} className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <caption className="flex items-center gap-2 pb-1.5 text-left text-[15px] font-bold">{b.line}: {fmt(b.score, 1)} de 12 <StatusPill s={b.status} /></caption>
            <thead>
              <tr className="th">
                <th className="px-2 py-1.5 text-left font-medium">Indicador</th><th className="px-2 text-right font-medium">Objetivo</th><th className="px-2 text-right font-medium">Real</th><th className="px-2 text-right font-medium">%</th>
                {c && <th className="px-2 text-right font-medium">Mes ant.</th>}
                <th className="px-2 text-right font-medium">Cumple</th><th className="px-2 text-right font-medium">Pts</th>
              </tr>
            </thead>
            <tbody>
              {b.items.map((x) => {
                const p = prevItem(c, s.sheet, b.line, x.name);
                const bd = itemBand(x);
                return (
                  <tr key={x.name} className="border-t border-line-2">
                    <td className="px-2 py-1.5">{prettyItem(x.name)}</td>
                    <td className="px-2 text-right">{fmt(x.obj, 2)}</td>
                    <td className="px-2 text-right">{fmt(x.real, 2)}</td>
                    <td className={clsx('px-2 text-right', bd === 'good' ? 'text-good-ink' : bd === 'crit' ? 'text-crit-ink' : '')}>{fmt(x.pct, 1)}%</td>
                    {c && <td className="px-2 text-right text-ink-2">{p ? `${fmt(p.pct, 1)}%` : '—'}</td>}
                    <td className={clsx('px-2 text-right font-semibold', x.ok ? 'text-good-ink' : 'text-crit-ink')}>{x.ok ? 'Sí' : 'No'}</td>
                    <td className="px-2 text-right">{fmt(x.pts, 1)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      <Button className="justify-self-start" onClick={onSimulate}>Simular escenarios de {s.display.split(' ')[0]}</Button>
    </div>
  );
}
