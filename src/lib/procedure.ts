import { KPI_LABEL, RULES, statusOf, tierPoints } from './rules';
import type { Block, Item, KpiKey, MonthReport, Seller, Status } from './types';

/**
 * Convierte el informe leído del Excel en la evaluación según el Procedimiento de KPI's:
 * cada línea queda con sus cuatro indicadores (crecimiento en ventas, cobranza a tiempo, atención
 * de cartera, nuevos clientes) puntuados por tramos. En Pruven el crecimiento se mide con los galones
 * totales contra la meta; las ventas por producto se conservan como información, sin puntos.
 * Los puntos que daba el Excel quedan en `excelPts` y en `excelScore` para comparar.
 */
export function applyProcedure(d: MonthReport): MonthReport {
  const sellers = d.sellers.map((s) => evaluateSeller(s, d));
  return { ...d, basis: 'procedimiento', sellers: sellers.sort((a, b) => b.total - a.total) };
}

function kpiItem(kpi: KpiKey, name: string, obj: number | null, real: number | null, excelPts: number | undefined): Item {
  const pct = obj ? ((real ?? 0) / obj) * 100 : null;
  const pts = pct == null ? 0 : tierPoints(kpi, pct);
  return { name, obj, real, pct, pts, ok: pts === 3, kpi, max: kpi === 'PROD' ? 0 : 3, excelPts };
}

function evaluateSeller(s: Seller, d: MonthReport): Seller {
  const zona = d.results?.zonas.find((z) => z.sheet === s.sheet);
  const blocks: Block[] = s.blocks.map((b) => {
    const find = (re: RegExp) => b.items.find((i) => re.test(i.name));
    const items: Item[] = [];
    let cv: Item;
    if (b.line === 'Pegutil') {
      const sacos = find(/SACOS/);
      cv = kpiItem('CV', 'Crecimiento en ventas (sacos)', sacos?.obj ?? s.sacos.meta, sacos?.real ?? s.sacos.real, sacos?.pts);
    } else {
      // El Excel reparte el crecimiento de Pruven en productos (0,5 pts c/u): se informa la suma como referencia.
      const prods = b.items.filter((i) => /^VENTAS/i.test(i.name));
      const excel = prods.length ? prods.reduce((a, i) => a + i.pts, 0) : undefined;
      cv = kpiItem('CV', 'Crecimiento en ventas (galones)', s.galones.meta, s.galones.real ?? zona?.galones ?? null, excel);
    }
    items.push(cv);
    const cob = find(/COBRANZA/);
    if (cob) items.push(kpiItem('CT', `${KPI_LABEL.CT} ${b.line}`, cob.obj, cob.real, cob.pts));
    const car = find(/CARTERA/);
    // El objetivo del Excel es el 70% de la cartera: la cartera total es objetivo ÷ 0,7.
    if (car) items.push(kpiItem('AC', KPI_LABEL.AC, car.obj != null ? car.obj / RULES.carteraObjetivo : null, car.real, car.pts));
    const nc = find(/NUEVOS CLIENTES/);
    if (nc) items.push(kpiItem('ANC', `Nuevos clientes ${b.line}`, nc.obj, nc.real, nc.pts));
    if (b.line === 'Pruven')
      for (const p of b.items.filter((i) => /^VENTAS/i.test(i.name))) items.push({ ...p, kpi: 'PROD', max: 0, pts: 0, ok: (p.pct ?? 0) >= 100, excelPts: p.pts });
    const score = items.reduce((a, i) => a + i.pts, 0);
    return { ...b, items, score, sum: score, stated: null, excelScore: b.score, excelStatus: b.status, status: statusOf(score, 'procedimiento') };
  });
  const total = blocks.reduce((a, b) => a + b.score, 0);
  return { ...s, blocks, total, status: statusOf(total / blocks.length, 'procedimiento'), excelTotal: s.total, excelStatus: s.status };
}

export interface BasisDiff {
  seller: string;
  line: string;
  excel: number;
  proc: number;
  excelStatus: Status;
  procStatus: Status;
}

/** Líneas en las que el Excel y el procedimiento dan otro puntaje. */
export function basisDiffs(proc: MonthReport): BasisDiff[] {
  return proc.sellers.flatMap((s) =>
    s.blocks
      .filter((b) => b.excelScore != null && Math.abs(b.excelScore - b.score) > 1e-9)
      .map((b) => ({ seller: s.display, line: b.line, excel: b.excelScore!, proc: b.score, excelStatus: b.excelStatus!, procStatus: b.status })),
  );
}
