'use client';

import ReactEChartsCore from 'echarts-for-react/lib/core';
import { BarChart, CustomChart, ScatterChart } from 'echarts/charts';
import { GridComponent, LegendComponent, MarkLineComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';
import { useEffect, useState } from 'react';

echarts.use([BarChart, ScatterChart, CustomChart, GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, SVGRenderer]);

const TOKENS = ['ink', 'ink-2', 'ink-3', 'line', 'line-2', 'panel', 'accent', 'peg', 'pru', 's3', 's4', 's5', 'prev', 'good', 'warn', 'crit', 'track'] as const;
export type Palette = Record<(typeof TOKENS)[number], string> & { mono: string; sans: string };

function readPalette(): Palette {
  // Se lee desde <body> porque ahí next/font define las variables de las fuentes.
  const cs = getComputedStyle(document.body);
  const colors = Object.fromEntries(TOKENS.map((t) => [t, cs.getPropertyValue(`--${t}`).trim()]));
  const mono = cs.getPropertyValue('--font-plex-mono').trim() || 'monospace';
  return { ...colors, mono, sans: getComputedStyle(document.body).fontFamily } as Palette;
}

/** Colores del tema actual; se actualiza al cambiar entre claro y oscuro. */
export function usePalette(): Palette | null {
  const [p, setP] = useState<Palette | null>(null);
  useEffect(() => {
    setP(readPalette());
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const on = () => setP(readPalette());
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return p;
}

export function baseOption(p: Palette) {
  return {
    animationDuration: 700,
    animationEasing: 'cubicOut',
    animationDurationUpdate: 500,
    textStyle: { fontFamily: p.sans, color: p['ink-2'] },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: p['line-2'], opacity: 0.6 } },
      backgroundColor: p.ink,
      borderWidth: 0,
      textStyle: { color: p.panel, fontSize: 12.5 },
      extraCssText: 'border-radius:6px;box-shadow:0 4px 14px rgb(0 0 0 / .18);',
    },
  };
}

export function valueAxis(p: Palette, extra: object = {}) {
  return {
    type: 'value',
    axisLabel: { color: p['ink-3'], fontSize: 11, fontFamily: p.mono },
    splitLine: { lineStyle: { color: p['line-2'] } },
    axisLine: { show: false },
    ...extra,
  };
}

export function categoryAxis(p: Palette, data: string[], extra: object = {}) {
  return {
    type: 'category',
    data,
    axisTick: { show: false },
    axisLine: { lineStyle: { color: p.line } },
    axisLabel: { color: p.ink, fontSize: 12.5 },
    ...extra,
  };
}

export default function EChart({ option, height, label }: { option: object; height: number; label: string }) {
  return (
    <div role="img" aria-label={label}>
      <ReactEChartsCore echarts={echarts} option={option} notMerge style={{ height, width: '100%' }} opts={{ renderer: 'svg' }} />
    </div>
  );
}
