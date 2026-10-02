'use client';

import { fmt } from '@/lib/format';
import type { PointLoss } from '@/lib/analysis';
import EChart, { baseOption, categoryAxis, usePalette, valueAxis } from './EChart';

type Tip = { name: string; seriesName: string; value: number; dataIndex: number; marker: string }[];

/** Puntos perdidos por indicador, coloreados por línea. */
export function PointLossChart({ data }: { data: PointLoss[] }) {
  const p = usePalette();
  if (!p) return <div style={{ height: 300 }} />;
  const rows = data.slice(0, 8).reverse();
  return (
    <EChart
      height={Math.max(220, rows.length * 38 + 40)}
      label="Puntos perdidos por indicador"
      option={{
        ...baseOption(p),
        grid: { left: 8, right: 36, top: 8, bottom: 24, containLabel: true },
        xAxis: valueAxis(p, { minInterval: 1 }),
        yAxis: categoryAxis(p, rows.map((r) => `${r.name} · ${r.line}`), { axisLabel: { color: p.ink, fontSize: 12.5, width: 190, overflow: 'truncate' } }),
        tooltip: {
          ...baseOption(p).tooltip,
          formatter: (ps: Tip) => {
            const r = rows[ps[0].dataIndex];
            return `<b>${r.name}</b> · ${r.line}<br/>${fmt(r.lost, 1)} de ${fmt(r.max, 1)} pts perdidos<br/>No cumplen: ${r.fails} de ${r.n}<br/>Cumplimiento promedio: ${fmt(r.avgPct)}%`;
          },
        },
        series: [{
          type: 'bar',
          barWidth: 18,
          data: rows.map((r) => ({ value: r.lost, itemStyle: { color: r.line === 'Pegutil' ? p.peg : p.pru, borderRadius: [0, 4, 4, 0] } })),
          label: { show: true, position: 'right', color: p.ink, fontWeight: 600, formatter: (x: { value: number }) => fmt(x.value, 1) },
        }],
      }}
    />
  );
}

export interface BarRow { name: string; sub?: string; value: number; meta: number | null; prev?: number | null }

/** Barras horizontales: vendido, meta (contorno) y opcionalmente el mes anterior. */
export function TargetBars({ rows, color, unit, prevLabel }: { rows: BarRow[]; color: 'peg' | 'pru'; unit: string; prevLabel?: string }) {
  const p = usePalette();
  if (!p) return <div style={{ height: 280 }} />;
  const r = rows.slice().reverse();
  const hasPrev = r.some((x) => x.prev != null);
  const c = p[color];
  return (
    <EChart
      height={Math.max(240, r.length * (hasPrev ? 54 : 44) + 60)}
      label={`Ventas por zona en ${unit}`}
      option={{
        ...baseOption(p),
        legend: { top: 0, left: 0, itemWidth: 12, itemHeight: 10, textStyle: { color: p['ink-2'], fontSize: 12 }, icon: 'roundRect' },
        grid: { left: 8, right: 48, top: 34, bottom: 24, containLabel: true },
        xAxis: valueAxis(p),
        yAxis: categoryAxis(p, r.map((x) => x.name)),
        tooltip: {
          ...baseOption(p).tooltip,
          formatter: (ps: Tip) => {
            const x = r[ps[0].dataIndex];
            const pct = x.meta ? ` (${fmt((x.value / x.meta) * 100, 1)}% de la meta)` : '';
            return `<b>${x.name}</b>${x.sub ? ` · ${x.sub}` : ''}<br/>Vendido: ${fmt(x.value, 1)} ${unit}${pct}<br/>Meta: ${x.meta ? fmt(x.meta) : 'sin meta individual'}${x.prev != null ? `<br/>${prevLabel}: ${fmt(x.prev, 1)}` : ''}`;
          },
        },
        series: [
          ...(hasPrev ? [{ name: prevLabel, type: 'bar', barWidth: 8, barGap: '30%', itemStyle: { color: p.prev, borderRadius: [0, 3, 3, 0] }, data: r.map((x) => x.prev ?? null), z: 1 }] : []),
          {
            name: 'Vendido', type: 'bar', barWidth: 16, barGap: hasPrev ? '30%' : '-100%', z: 3,
            itemStyle: { color: c, borderRadius: [0, 4, 4, 0] },
            label: { show: true, position: 'right', color: p.ink, fontWeight: 600, fontSize: 12, formatter: (x: { dataIndex: number }) => { const row = r[x.dataIndex]; return row.meta ? `${fmt((row.value / row.meta) * 100)}%` : fmt(row.value); } },
            data: r.map((x) => x.value),
          },
          {
            name: 'Meta', type: 'scatter', symbol: 'rect', symbolSize: [3, 24], z: 2,
            itemStyle: { color: p.ink }, data: r.map((x) => (x.meta ? [x.meta, x.name] : null)).map((v) => v ?? '-'),
            encode: { x: 0, y: 1 },
          },
        ],
      }}
    />
  );
}

/** Barras con una línea de referencia (promedio o 100%). */
export function RefBars({ rows, color, refValue, refLabel, suffix = '', label }: { rows: { name: string; value: number; tip: string }[]; color: 'peg' | 'pru'; refValue: number; refLabel: string; suffix?: string; label: string }) {
  const p = usePalette();
  if (!p) return <div style={{ height: 260 }} />;
  const r = rows.slice().reverse();
  return (
    <EChart
      height={Math.max(220, r.length * 40 + 50)}
      label={label}
      option={{
        ...baseOption(p),
        grid: { left: 8, right: 52, top: 22, bottom: 24, containLabel: true },
        xAxis: valueAxis(p, { axisLabel: { color: p['ink-3'], fontSize: 11, fontFamily: p.mono, formatter: (v: number) => fmt(v) + suffix } }),
        yAxis: categoryAxis(p, r.map((x) => x.name)),
        tooltip: { ...baseOption(p).tooltip, formatter: (ps: Tip) => r[ps[0].dataIndex].tip },
        series: [{
          type: 'bar', barWidth: 18,
          itemStyle: { color: p[color], borderRadius: [0, 4, 4, 0] },
          label: { show: true, position: 'right', color: p.ink, fontWeight: 600, formatter: (x: { value: number }) => fmt(x.value, 1) + suffix },
          data: r.map((x) => x.value),
          markLine: {
            symbol: 'none', silent: true,
            lineStyle: { color: p['ink-2'], type: 'dashed', width: 1.5 },
            label: { formatter: refLabel, color: p['ink-2'], fontSize: 11, position: 'end' },
            data: [{ xAxis: refValue }],
          },
        }],
      }}
    />
  );
}

export interface Dumbbell { name: string; prev: number; cur: number }

/** Puntaje de cada vendedor: mes anterior → mes actual. */
export function DumbbellChart({ rows, prevLabel, curLabel }: { rows: Dumbbell[]; prevLabel: string; curLabel: string }) {
  const p = usePalette();
  if (!p) return <div style={{ height: 240 }} />;
  const r = rows.slice().reverse();
  const names = r.map((x) => x.name);
  return (
    <EChart
      height={Math.max(200, r.length * 44 + 60)}
      label={`Puntaje por vendedor, ${prevLabel} y ${curLabel}`}
      option={{
        ...baseOption(p),
        legend: { top: 0, left: 0, itemWidth: 10, itemHeight: 10, textStyle: { color: p['ink-2'], fontSize: 12 } },
        grid: { left: 8, right: 40, top: 34, bottom: 24, containLabel: true },
        xAxis: valueAxis(p, { min: 0, max: 24, interval: 4 }),
        yAxis: categoryAxis(p, names),
        tooltip: {
          ...baseOption(p).tooltip, trigger: 'item',
          formatter: (x: { dataIndex: number }) => { const d = r[x.dataIndex]; return `<b>${d.name}</b><br/>${prevLabel}: ${fmt(d.prev, 1)} pts<br/>${curLabel}: ${fmt(d.cur, 1)} pts`; },
        },
        series: [
          {
            type: 'custom', silent: true, z: 1,
            renderItem: (_: unknown, api: { value: (i: number) => number; coord: (v: [number, number]) => [number, number] }) => {
              const a = api.coord([api.value(0), api.value(2)]), b = api.coord([api.value(1), api.value(2)]);
              const up = api.value(1) >= api.value(0);
              return { type: 'line', shape: { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, style: { stroke: up ? p.good : p.crit, lineWidth: 3, opacity: 0.55 } };
            },
            data: r.map((x, i) => [x.prev, x.cur, i]),
            encode: { x: [0, 1], y: 2 },
          },
          { name: prevLabel, type: 'scatter', symbolSize: 12, itemStyle: { color: p.prev, borderColor: p.panel, borderWidth: 2 }, data: r.map((x) => [x.prev, x.name]), z: 2 },
          {
            name: curLabel, type: 'scatter', symbolSize: 14, itemStyle: { color: p.accent, borderColor: p.panel, borderWidth: 2 }, z: 3,
            label: { show: true, color: p.ink, fontWeight: 600, distance: 8, formatter: (x: { dataIndex: number }) => fmt(r[x.dataIndex].cur, 1) },
            // La etiqueta va del lado opuesto al mes anterior para no quedar sobre la línea.
            data: r.map((x) => ({ value: [x.cur, x.name], label: { position: x.cur < x.prev ? 'left' : 'right' } })),
          },
        ],
      }}
    />
  );
}
