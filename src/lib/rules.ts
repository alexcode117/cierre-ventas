import type { Block, Item, Status } from './types';

/**
 * Reglas de puntaje en un solo lugar. Las usan el lector (para revisar el CUMPLE del Excel),
 * el análisis, el simulador y el informe. Si la empresa cambia una regla, se cambia aquí.
 *
 * La leyenda del Excel ("mayor a 10", "de 4 a 9", "menor a 3") deja sin clasificar el 3 y los
 * puntajes entre 9 y 10; se completa así: Productivo desde 10, Estable desde 4, Crítico por debajo.
 */
export const RULES = {
  /** % del objetivo para cumplir un indicador de ventas, clientes o cartera. */
  cumplePct: 100,
  /** % del objetivo para cumplir cobranza (el Excel marca SI desde 0,90). */
  cobranzaPct: 90,
  /** Puntaje mínimo de una línea (máx. 12) para cada estado. */
  productivo: 10,
  estable: 4,
  /** Puntos de un indicador cumplido. */
  ptsVentaPruven: 0.5,
  ptsDefault: 3,
} as const;

export function statusOf(score: number): Status {
  return score >= RULES.productivo ? 'PRODUCTIVO' : score >= RULES.estable ? 'ESTABLE' : 'CRITICO';
}

export const isCobranza = (name: string) => /COBRANZA/i.test(name);

/** Umbral (en %) que aplica a un indicador. */
export const thresholdOf = (item: Pick<Item, 'name'>) => (isCobranza(item.name) ? RULES.cobranzaPct : RULES.cumplePct);

export function meetsTarget(item: Pick<Item, 'name'>, pct: number): boolean {
  return pct >= thresholdOf(item) - 1e-9;
}

/** Puntos que vale un indicador cumplido. */
export function itemMax(block: Pick<Block, 'line'>, item: Pick<Item, 'name' | 'pts'>): number {
  if (item.pts > 0) return item.pts;
  return block.line === 'Pruven' && /^VENTAS/i.test(item.name) ? RULES.ptsVentaPruven : RULES.ptsDefault;
}

/** Puntos que corresponden según la regla (no según lo que dice el Excel). */
export function rulePoints(block: Pick<Block, 'line'>, item: Item): number {
  if (item.pct == null) return item.pts;
  return meetsTarget(item, item.pct) ? itemMax(block, item) : 0;
}

export const RULES_TEXT = `Un indicador se cumple con el ${RULES.cumplePct}% del objetivo (cobranza con el ${RULES.cobranzaPct}%). Estado por línea (máx. 12 pts): Productivo desde ${RULES.productivo}, Estable desde ${RULES.estable}, Crítico por debajo de ${RULES.estable}.`;
