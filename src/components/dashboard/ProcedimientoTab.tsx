'use client';

import clsx from 'clsx';
import { motion } from 'framer-motion';
import { useMemo } from 'react';
import { AWARD_STATUS_LABEL, pctDiffers } from '@/lib/awards';
import { fmt, itemBand, ptsLabel, STATUS_LABEL, titleCase } from '@/lib/format';
import type { Session } from '@/lib/load';
import { applyProcedure } from '@/lib/procedure';
import { INCENTIVES, KPI_LABEL, PROCEDURE_TIERS, STATUS_THRESHOLDS } from '@/lib/rules';
import type { Basis, KpiKey } from '@/lib/types';
import { Button, Card, fadeUp, Pill, SectionHead, stagger, StatusPill } from '../ui';

const KPIS: Exclude<KpiKey, 'PROD'>[] = ['CV', 'CT', 'AC', 'ANC'];
const FORMULA: Record<Exclude<KpiKey, 'PROD'>, string> = {
  CV: 'Ventas realizadas en el período ÷ meta de ventas del período (sacos en Pegutil, galones en Pruven)',
  CT: 'Monto cobrado a tiempo (hasta 40 días desde la emisión) ÷ monto total de notas a vencer en el período',
  AC: 'Clientes de la cartera que hicieron pedidos ÷ total de clientes en la cartera del vendedor',
  ANC: 'Clientes nuevos que hicieron pedidos ÷ meta de clientes nuevos',
};
const CELL = { good: 'bg-good-bg text-good-ink', warn: 'bg-warn-bg text-warn-ink', crit: 'bg-crit-bg text-crit-ink', none: 'text-ink-3' };

export default function ProcedimientoTab({ session, onBasis }: { session: Session; onBasis: (b: Basis) => void }) {
  // La comparación siempre se hace sobre la evaluación según el procedimiento, sea cual sea la base activa.
  const proc = useMemo(() => (session.basis === 'procedimiento' ? session.cur.report : applyProcedure(session.source.cur.report)), [session]);
  const t = STATUS_THRESHOLDS;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="grid gap-7">
      <motion.section variants={fadeUp} className="grid gap-2">
        <span className="eyebrow">Norma de referencia</span>
        <h2 className="display text-2xl font-bold" style={{ fontStretch: '85%' }}>Procedimiento para cálculo de KPI&apos;s e incentivos para ventas</h2>
        <p className="max-w-[75ch] text-[14px] text-ink-2">
          Elaborado el 08/01/2025 para Pegamentos Útiles de Venezuela (Pegutil) y Productos Útiles de Venezuela (Pruven). Mide cuatro indicadores por empresa con tramos de 3, 1 y 0 puntos; su suma define el estado del vendedor y el ganador de &quot;mejor manejo de variables&quot;.
        </p>
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className="text-ink-2">El dashboard está usando: <b className="text-ink">{session.basis === 'procedimiento' ? 'el procedimiento' : 'los puntos del Excel'}</b>.</span>
          <Button onClick={() => onBasis(session.basis === 'procedimiento' ? 'excel' : 'procedimiento')}>
            Ver con {session.basis === 'procedimiento' ? 'los puntos del Excel' : 'el procedimiento'}
          </Button>
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-3">
        <SectionHead title="Excel frente al procedimiento" sub="Puntaje por línea (máx. 12) y puntos de cada indicador según el procedimiento" />
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-line font-mono text-[10.5px] tracking-wider text-ink-3 uppercase">
                <th className="py-2.5 pr-3 pl-4.5 text-left font-medium">Vendedor · línea</th>
                {KPIS.map((k) => <th key={k} className="px-2 text-center font-medium">{KPI_LABEL[k]}</th>)}
                <th className="px-3 text-right font-medium">Excel</th>
                <th className="px-3 text-right font-medium">Procedimiento</th>
              </tr>
            </thead>
            <tbody>
              {proc.sellers.flatMap((s) => s.blocks.map((b) => {
                const changed = b.excelScore != null && Math.abs(b.excelScore - b.score) > 1e-9;
                return (
                  <tr key={s.sheet + b.line} className={clsx('border-b border-line-2 last:border-b-0', changed && 'bg-warn-bg/40')}>
                    <td className="py-2 pr-3 pl-4.5 whitespace-nowrap"><b className="font-semibold">{s.display}</b> <span className="text-ink-2">· {b.line}</span></td>
                    {KPIS.map((k) => {
                      const it = b.items.find((i) => i.kpi === k);
                      if (!it) return <td key={k} className="px-2 text-center text-ink-3">—</td>;
                      return (
                        <td key={k} className="px-1.5 py-1">
                          <div title={`${it.name}\nLogrado: ${fmt(it.pct, 1)}%\nProcedimiento: ${ptsLabel(it.pts)} · Excel: ${ptsLabel(it.excelPts)}`}
                            className={clsx('mx-auto min-w-[92px] rounded-md px-2 py-1 text-center', CELL[itemBand(it)])}>
                            <div className="font-semibold">{fmt(it.pct, 1)}%</div>
                            <div className="text-[11.5px]">{ptsLabel(it.pts)}{it.excelPts != null && it.excelPts !== it.pts ? <span className="opacity-80"> (Excel {fmt(it.excelPts, 1)})</span> : null}</div>
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 text-right whitespace-nowrap">{fmt(b.excelScore, 1)} {b.excelStatus && <StatusPill s={b.excelStatus} />}</td>
                    <td className="px-3 text-right whitespace-nowrap"><b>{fmt(b.score, 1)}</b> <StatusPill s={b.status} /></td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </Card>
        <p className="text-[12.5px] text-ink-3">
          En Pruven, la columna Excel de crecimiento suma los puntos de las ventas por producto (6 × 0,5). La atención de cartera se calcula sobre la cartera total, estimada como el objetivo del Excel ÷ 0,7 (el Excel fija la meta en el 70% de la cartera).
        </p>
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-3">
        <SectionHead title="Fórmulas y rangos" sub="Puntuación de cada indicador según el procedimiento" />
        <Card className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-line font-mono text-[10.5px] tracking-wider text-ink-3 uppercase">
                <th className="py-2.5 pr-3 pl-4.5 text-left font-medium">Indicador</th>
                <th className="px-3 text-left font-medium">Fórmula</th>
                <th className="px-3 text-center font-medium">3 pts</th>
                <th className="px-3 text-center font-medium">1 pt</th>
                <th className="px-3 text-center font-medium">0 pts</th>
              </tr>
            </thead>
            <tbody>
              {KPIS.map((k) => {
                const tiers = PROCEDURE_TIERS[k];
                const one = tiers.find(([, p]) => p === 1);
                return (
                  <tr key={k} className="border-b border-line-2 align-top last:border-b-0">
                    <td className="py-2.5 pr-3 pl-4.5 font-semibold whitespace-nowrap">{KPI_LABEL[k]}</td>
                    <td className="px-3 py-2.5 text-ink-2">{FORMULA[k]}</td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">{k === 'ANC' ? 'Cumple' : `≥ ${tiers[0][0]}%`}</td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">{one ? `${one[0]}% a ${tiers[0][0]}%` : '—'}</td>
                    <td className="px-3 py-2.5 text-center whitespace-nowrap">{k === 'ANC' ? 'No cumple' : `< ${(one ?? tiers[0])[0]}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="grid gap-2 px-4.5 py-4 text-[13.5px]">
            <h3 className="display text-base font-bold">Estados</h3>
            <div className="flex flex-wrap gap-2">
              <StatusPill s="PRODUCTIVO">desde {t.procedimiento.productivo} pts</StatusPill>
              <StatusPill s="ESTABLE">{t.procedimiento.estable} a {t.procedimiento.productivo - 0.5} pts</StatusPill>
              <StatusPill s="CRITICO">menos de {t.procedimiento.estable} pts</StatusPill>
            </div>
            <p className="text-ink-2">
              El documento dice &quot;Productivo mayor o igual a 7, Estable entre 4 y 6, Crítico menor a 3&quot;: no clasifica el 3 ni los puntajes entre 6 y 7. La herramienta los completa como se muestra arriba. El Excel usa otra escala ({STATUS_LABEL.PRODUCTIVO} desde {t.excel.productivo}).
            </p>
          </Card>
          <Card className="grid gap-2 px-4.5 py-4 text-[13.5px]">
            <h3 className="display text-base font-bold">Diferencias con el Excel actual</h3>
            <ul className="list-disc space-y-1 pl-5 text-ink-2">
              <li>Cobranza del 90% al 99%: el Excel da 3 pts; el procedimiento, 1 pt.</li>
              <li>Ventas del 90% al 99%: el procedimiento da 1 pt; el Excel, 0 (o 3 si se marcó &quot;SI&quot; a mano).</li>
              <li>Pruven: el Excel reparte el crecimiento en 6 productos de 0,5 pts; el procedimiento mide los galones totales contra la meta.</li>
              <li>Atención de cartera: el procedimiento da 1 pt desde el 50% de la cartera; el Excel solo puntúa al llegar al 70%.</li>
            </ul>
          </Card>
        </div>
      </motion.section>

      <motion.section variants={fadeUp} className="grid gap-3">
        <SectionHead title="Tabla de incentivos" sub="% sobre la base de cálculo según el procedimiento, frente a lo que asigna RESULTADOS" />
        <div className="grid gap-3 lg:grid-cols-2">
          {(['Pegutil', 'Pruven'] as const).map((line) => {
            const rows = INCENTIVES[line];
            const excelTotal = session.awards.filter((c) => c.award.line === line && c.status !== 'missing').reduce((a, c) => a + (c.award.pct ?? 0), 0);
            return (
              <Card key={line} className="overflow-x-auto">
                <h3 className="display px-4.5 pt-3.5 text-base font-bold">{line === 'Pegutil' ? 'Pegamentos Útiles (Pegutil)' : 'Productos Útiles (Pruven)'}</h3>
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line font-mono text-[10.5px] tracking-wider text-ink-3 uppercase">
                      <th className="py-2 pr-3 pl-4.5 text-left font-medium">Incentivo</th>
                      <th className="px-2 text-right font-medium">Oficial</th>
                      <th className="px-2 text-right font-medium">Excel</th>
                      <th className="px-3 text-left font-medium">Ganador en el Excel</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const c = session.awards.find((x) => x.award.line === line && x.key === r.key);
                      const excelPct = c && c.status !== 'missing' ? c.award.pct : null;
                      return (
                        <tr key={r.key} className="border-b border-line-2 align-top">
                          <td className="py-2 pr-3 pl-4.5">{r.label}<small className="block text-[11.5px] text-ink-3">Base: {r.base.toLowerCase()}</small></td>
                          <td className="px-2 py-2 text-right">{fmt(r.pct, 2)}%</td>
                          <td className={clsx('px-2 py-2 text-right', c && pctDiffers(c) && 'font-semibold text-crit-ink', excelPct == null && 'text-crit-ink')}>{excelPct != null ? `${fmt(excelPct, 2)}%` : 'no asignado'}</td>
                          <td className="px-3 py-2">
                            {c && c.status !== 'missing' && <span className="mr-1.5">{titleCase(c.award.ejecutivo)}</span>}
                            {c && <Pill className={c.status === 'ok' ? 'bg-good-bg text-good-ink' : c.status === 'tie' ? 'bg-warn-bg text-warn-ink' : c.status === 'unverifiable' ? 'bg-line-2 text-ink-2' : 'bg-crit-bg text-crit-ink'}>{AWARD_STATUS_LABEL[c.status]}</Pill>}
                            {c && c.status !== 'ok' && <small className="mt-1 block text-[12px] leading-snug text-ink-2">{c.detail}</small>}
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="font-semibold">
                      <td className="py-2 pr-3 pl-4.5">Total</td>
                      <td className="px-2 text-right">{fmt(rows.reduce((a, r) => a + r.pct, 0), 2)}%</td>
                      <td className="px-2 text-right">{fmt(excelTotal, 2)}%</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
              </Card>
            );
          })}
        </div>
        <p className="text-[12.5px] text-ink-3">
          El monto de cada incentivo es el % por la base de cálculo (ventas o cobranza del mes, en dinero). El Excel actual no trae esos montos, por eso la herramienta no los calcula.
        </p>
      </motion.section>
    </motion.div>
  );
}
