import type { Basis, Block, Item, KpiKey, Line, Status } from './types';

/**
 * Reglas de puntaje en un solo lugar, según el "Procedimiento para el cálculo de KPI's e incentivos de
 * ventas" (modificado el 13/10/2026). El libro INDICADORES ya aplica los mismos tramos, así que hay dos
 * bases de cálculo que solo difieren en el crecimiento de Pruven:
 *
 * - 'procedimiento' (por defecto): el crecimiento de Pruven se mide con los galones totales contra la meta.
 * - 'excel': los puntos del libro, donde el crecimiento de Pruven se reparte en ventas por producto
 *   (0,5 pts cada una desde el 80% de su meta).
 *
 * Atención de cartera se mide, como en el libro, contra su objetivo (el 70% de la cartera).
 * Las usan el lector (para revisar los puntos del Excel), la evaluación según el procedimiento,
 * el análisis, el simulador y el informe.
 */

/** Tramos del procedimiento: [% mínimo, puntos], de mayor a menor. */
export const PROCEDURE_TIERS: Record<Exclude<KpiKey, 'PROD'>, [number, number][]> = {
  CV: [[100, 3], [90, 2], [80, 1]],
  CT: [[100, 3], [90, 2], [80, 1]],
  AC: [[70, 3], [60, 2], [50, 1]],
  ANC: [[100, 3], [50, 1.5]],
};

export const KPI_LABEL: Record<KpiKey, string> = {
  CV: 'Crecimiento en ventas',
  CT: 'Cobranza a tiempo',
  AC: 'Atención de cartera',
  ANC: 'Activación de nuevos clientes',
  PROD: 'Venta por producto',
};

/**
 * Estados por línea (máx. 12 pts), definidos por la gerencia para las dos bases: Productivo más de 9,
 * Estable más de 3 y hasta 9, Crítico 3 o menos. Reemplaza la escala del procedimiento ("mayor o igual a 7,
 * entre 4 y 6, menor a 3") y la leyenda del Excel ("mayor a 10", "de 4 a 9", "menor a 3"), que dejaban
 * puntajes sin clasificar. Los umbrales son estrictos: hay que superarlos.
 */
const STATUS_SCALE = { productivo: 9, estable: 3 };
export const STATUS_THRESHOLDS: Record<Basis, { productivo: number; estable: number }> = {
  procedimiento: STATUS_SCALE,
  excel: STATUS_SCALE,
};

/** "Productivo más de 9, Estable más de 3 y hasta 9, Crítico 3 o menos" */
export const statusScaleText = (basis: Basis = 'procedimiento') => {
  const t = STATUS_THRESHOLDS[basis];
  return `Productivo más de ${t.productivo}, Estable más de ${t.estable} y hasta ${t.productivo}, Crítico ${t.estable} o menos`;
};

export const RULES = {
  /** Excel: % de la meta de un producto Pruven desde el que suma sus 0,5 pts. */
  productoPct: 80,
  ptsVentaPruven: 0.5,
  ptsDefault: 3,
} as const;

/** Porcentajes de incentivo sobre la base de cálculo, según el procedimiento. */
export const INCENTIVES: Record<Line, { key: 'CV' | 'CT' | 'AC' | 'ANC'; label: string; pct: number; base: string }[]> = {
  Pegutil: [
    { key: 'CV', label: 'Mayor crecimiento en ventas', pct: 0.7, base: 'Ventas totales del mes' },
    { key: 'CT', label: 'Cobranza a tiempo', pct: 0.45, base: 'Cobranza realizada en el mes' },
    { key: 'AC', label: 'Atención de cartera', pct: 0.13, base: 'Ventas totales del mes' },
    { key: 'ANC', label: 'Activación de nuevos clientes', pct: 0.1, base: 'Ventas totales del mes' },
  ],
  Pruven: [
    { key: 'CV', label: 'Mayor crecimiento en ventas', pct: 0.7, base: 'Ventas totales del mes' },
    { key: 'CT', label: 'Cobranza a tiempo', pct: 0.45, base: 'Cobranza realizada en el mes' },
    { key: 'AC', label: 'Atención de cartera', pct: 0.12, base: 'Ventas totales del mes' },
    { key: 'ANC', label: 'Activación de nuevos clientes', pct: 0.1, base: 'Ventas totales del mes' },
  ],
};

export function statusOf(score: number, basis: Basis = 'excel'): Status {
  const t = STATUS_THRESHOLDS[basis];
  return score > t.productivo + 1e-9 ? 'PRODUCTIVO' : score > t.estable + 1e-9 ? 'ESTABLE' : 'CRITICO';
}

const STATUS_RANK: Record<Status, number> = { PRODUCTIVO: 2, ESTABLE: 1, CRITICO: 0 };

/**
 * Estado agregado de un vendedor (el mejor de sus líneas), solo para uso interno: la calificación oficial es
 * por empresa, y la interfaz y el informe muestran el estado de cada línea (`block.status`).
 */
export function sellerStatus(blocks: Pick<Block, 'status'>[]): Status {
  return blocks.reduce<Status>((best, b) => (STATUS_RANK[b.status] > STATUS_RANK[best] ? b.status : best), 'CRITICO');
}

export const isCobranza = (name: string) => /COBRANZA/i.test(name);

/** Indicador del procedimiento al que corresponde una fila del Excel (PROD = venta de un producto Pruven). */
export function kpiOf(block: Pick<Block, 'line'>, item: Pick<Item, 'name' | 'kpi'>): KpiKey | null {
  if (item.kpi) return item.kpi;
  const n = item.name.toUpperCase();
  if (isCobranza(n)) return 'CT';
  if (/CARTERA/.test(n)) return 'AC';
  if (/NUEVOS CLIENTES/.test(n)) return 'ANC';
  if (/^\s*VENTAS/.test(n)) return block.line === 'Pruven' && !/SACOS|GALONES/.test(n) ? 'PROD' : 'CV';
  return null;
}

/** Puntos que vale un indicador cumplido. */
export function itemMax(block: Pick<Block, 'line'>, item: Pick<Item, 'name' | 'pts' | 'max'>): number {
  if (item.max != null) return item.max;
  return kpiOf(block, item) === 'PROD' ? RULES.ptsVentaPruven : RULES.ptsDefault;
}

/** Puntos según los tramos del procedimiento. */
export function tierPoints(kpi: KpiKey, pct: number): number {
  if (kpi === 'PROD') return 0;
  for (const [min, pts] of PROCEDURE_TIERS[kpi]) if (pct >= min - 1e-9) return pts;
  return 0;
}

/** Puntos de un indicador con un % dado: tramos del procedimiento; un producto Pruven del Excel, 0,5 desde el 80%. */
export function scoreAt(block: Pick<Block, 'line'>, item: Item, pct: number): number {
  const k = kpiOf(block, item);
  if (!k) return pct >= 100 - 1e-9 ? itemMax(block, item) : 0;
  if (k === 'PROD') return item.kpi ? 0 : pct >= RULES.productoPct - 1e-9 ? itemMax(block, item) : 0;
  return tierPoints(k, pct);
}

/** Puntos que corresponden según la regla (no según lo que dice el Excel). */
export function rulePoints(block: Pick<Block, 'line'>, item: Item): number {
  if (item.pct == null) return item.pts;
  return scoreAt(block, item, item.pct);
}

/** Con otro valor real, ¿cambian los puntos del indicador? */
export function pointsChange(block: Pick<Block, 'line'>, item: Item, a: number, b: number): boolean {
  return scoreAt(block, item, a) !== scoreAt(block, item, b);
}

/** Siguiente tramo alcanzable de un indicador: % a lograr y puntos que suma. */
export function nextStep(block: Pick<Block, 'line'>, item: Item): { pct: number; gain: number } | null {
  if (item.pct == null || !item.obj) return null;
  const k = kpiOf(block, item);
  if (k === 'PROD') {
    if (item.kpi || item.pts > 0) return null;
    return { pct: RULES.productoPct, gain: itemMax(block, item) };
  }
  if (!k) return item.ok ? null : { pct: 100, gain: itemMax(block, item) - item.pts };
  const up = PROCEDURE_TIERS[k].filter(([, p]) => p > item.pts).sort((a, b) => a[0] - b[0])[0];
  return up ? { pct: up[0], gain: up[1] - item.pts } : null;
}

/** "3 pts desde 100%, 2 pts desde 90% y 1 pt desde 80%" */
export function tiersText(k: Exclude<KpiKey, 'PROD'>): string {
  const parts = PROCEDURE_TIERS[k].map(([min, p]) => `${String(p).replace('.', ',')} ${p === 1 ? 'pt' : 'pts'} desde el ${min}%`);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : parts[0];
}

export function rulesText(basis: Basis): string {
  const estados = `Estado por línea (máx. 12 pts): ${statusScaleText(basis)}.`;
  const tramos = `crecimiento en ventas y cobranza a tiempo dan ${tiersText('CV')}; atención de cartera (sobre su objetivo), ${tiersText('AC')}; nuevos clientes, ${tiersText('ANC')}.`;
  if (basis === 'procedimiento')
    return `Procedimiento de KPI's (13/10/2026): ${tramos} En Pruven el crecimiento se mide con los galones totales. ${estados}`;
  return `Puntos del Excel: ${tramos} En Pruven el crecimiento se reparte en ventas por producto, 0,5 pts cada una desde el ${RULES.productoPct}% de su meta. ${estados}`;
}

/** Texto de la regla del Excel; se mantiene para quien lo importe con el nombre anterior. */
export const RULES_TEXT = rulesText('excel');
