import type { Basis, Block, Item, KpiKey, Line, Status } from './types';

/**
 * Reglas de puntaje en un solo lugar. Hay dos bases de cálculo:
 *
 * - 'procedimiento' (por defecto): "Procedimiento para cálculo de KPI's e incentivos para ventas",
 *   elaborado el 08/01/2025. Cuatro indicadores por empresa con tramos de 3, 1 y 0 puntos.
 * - 'excel': lo que aplica hoy el libro INDICADORES (cumple con 100%, cobranza con 90%, todo o nada).
 *
 * Las usan el lector (para revisar el CUMPLE del Excel), la evaluación según el procedimiento,
 * el análisis, el simulador y el informe.
 */

/** Tramos del procedimiento: [% mínimo, puntos], de mayor a menor. */
export const PROCEDURE_TIERS: Record<Exclude<KpiKey, 'PROD'>, [number, number][]> = {
  CV: [[100, 3], [90, 1]],
  CT: [[100, 3], [90, 1]],
  AC: [[70, 3], [50, 1]],
  ANC: [[100, 3]],
};

export const KPI_LABEL: Record<KpiKey, string> = {
  CV: 'Crecimiento en ventas',
  CT: 'Cobranza a tiempo',
  AC: 'Atención de cartera',
  ANC: 'Activación de nuevos clientes',
  PROD: 'Venta por producto',
};

/**
 * Estados por línea (máx. 12 pts). El procedimiento dice "Productivo mayor o igual a 7, Estable entre
 * 4 y 6, Crítico menor a 3", lo que deja sin clasificar el 3 y los puntajes entre 6 y 7; se completa
 * así: Productivo desde 7, Estable desde 4, Crítico por debajo de 4. La leyenda del Excel ("mayor a 10",
 * "de 4 a 9", "menor a 3") se completa igual: Productivo desde 10.
 */
export const STATUS_THRESHOLDS: Record<Basis, { productivo: number; estable: number }> = {
  procedimiento: { productivo: 7, estable: 4 },
  excel: { productivo: 10, estable: 4 },
};

export const RULES = {
  /** Excel: % del objetivo para cumplir un indicador de ventas, clientes o cartera. */
  cumplePct: 100,
  /** Excel: % del objetivo para cumplir cobranza (el Excel marca SI desde 0,90). */
  cobranzaPct: 90,
  /** Excel: el objetivo de atención de cartera es el 70% de la cartera total. */
  carteraObjetivo: 0.7,
  ptsVentaPruven: 0.5,
  ptsDefault: 3,
} as const;

/** Porcentajes de incentivo sobre la base de cálculo, según el procedimiento. */
export const INCENTIVES: Record<Line, { key: 'CV' | 'CT' | 'AC' | 'ANC'; label: string; pct: number; base: string }[]> = {
  Pegutil: [
    { key: 'CV', label: 'Mayor incremento de ventas', pct: 0.65, base: 'Ventas totales en el mes' },
    { key: 'CT', label: 'Cobranza a tiempo', pct: 0.45, base: 'Cobranza realizada en el mes' },
    { key: 'AC', label: 'Atención de cartera', pct: 0.13, base: 'Ventas totales en el mes' },
    { key: 'ANC', label: 'Activación de nuevos clientes', pct: 0.1, base: 'Ventas totales en el mes' },
  ],
  Pruven: [
    { key: 'CV', label: 'Mayor incremento de ventas', pct: 0.65, base: 'Ventas totales en el mes' },
    { key: 'CT', label: 'Cobranza a tiempo', pct: 0.45, base: 'Cobranza realizada en el mes' },
    { key: 'AC', label: 'Atención de cartera', pct: 0.12, base: 'Ventas totales en el mes' },
    { key: 'ANC', label: 'Activación de nuevos clientes', pct: 0.1, base: 'Ventas totales en el mes' },
  ],
};

export function statusOf(score: number, basis: Basis = 'excel'): Status {
  const t = STATUS_THRESHOLDS[basis];
  return score >= t.productivo ? 'PRODUCTIVO' : score >= t.estable ? 'ESTABLE' : 'CRITICO';
}

export const isCobranza = (name: string) => /COBRANZA/i.test(name);

/** Umbral (en %) del Excel para un indicador. */
export const thresholdOf = (item: Pick<Item, 'name'>) => (isCobranza(item.name) ? RULES.cobranzaPct : RULES.cumplePct);

export function meetsTarget(item: Pick<Item, 'name'>, pct: number): boolean {
  return pct >= thresholdOf(item) - 1e-9;
}

/** Puntos que vale un indicador cumplido. */
export function itemMax(block: Pick<Block, 'line'>, item: Pick<Item, 'name' | 'pts' | 'max'>): number {
  if (item.max != null) return item.max;
  if (item.pts > 0) return item.pts;
  return block.line === 'Pruven' && /^VENTAS/i.test(item.name) ? RULES.ptsVentaPruven : RULES.ptsDefault;
}

/** Puntos según los tramos del procedimiento. */
export function tierPoints(kpi: KpiKey, pct: number): number {
  if (kpi === 'PROD') return 0;
  for (const [min, pts] of PROCEDURE_TIERS[kpi]) if (pct >= min - 1e-9) return pts;
  return 0;
}

/** Puntos de un indicador con un % dado, según la regla que corresponde al indicador. */
export function scoreAt(block: Pick<Block, 'line'>, item: Item, pct: number): number {
  if (item.kpi) return tierPoints(item.kpi, pct);
  return meetsTarget(item, pct) ? itemMax(block, item) : 0;
}

/** Puntos que corresponden según la regla del Excel (no según lo que dice el Excel). */
export function rulePoints(block: Pick<Block, 'line'>, item: Item): number {
  if (item.pct == null) return item.pts;
  return scoreAt(block, item, item.pct);
}

/** Siguiente tramo alcanzable de un indicador: % a lograr y puntos que suma. */
export function nextStep(block: Pick<Block, 'line'>, item: Item): { pct: number; gain: number } | null {
  if (item.pct == null || !item.obj) return null;
  if (item.kpi) {
    if (item.kpi === 'PROD') return null;
    const up = PROCEDURE_TIERS[item.kpi].filter(([, p]) => p > item.pts).sort((a, b) => a[0] - b[0])[0];
    return up ? { pct: up[0], gain: up[1] - item.pts } : null;
  }
  if (item.ok) return null;
  return { pct: thresholdOf(item), gain: itemMax(block, item) - item.pts };
}

export function rulesText(basis: Basis): string {
  const t = STATUS_THRESHOLDS[basis];
  const estados = `Estado por línea (máx. 12 pts): Productivo desde ${t.productivo}, Estable desde ${t.estable}, Crítico por debajo de ${t.estable}.`;
  if (basis === 'procedimiento')
    return `Procedimiento de KPI's (08/01/2025): crecimiento en ventas y cobranza dan 3 pts desde el 100% y 1 pt desde el 90%; atención de cartera, 3 pts desde el 70% de la cartera y 1 pt desde el 50%; nuevos clientes, 3 pts si cumple. ${estados}`;
  return `Reglas del Excel: un indicador se cumple con el ${RULES.cumplePct}% del objetivo (cobranza con el ${RULES.cobranzaPct}%). ${estados}`;
}

/** Texto de la regla del Excel; se mantiene para quien lo importe con el nombre anterior. */
export const RULES_TEXT = rulesText('excel');
