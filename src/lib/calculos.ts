import { fmt } from './format';
import { findSeller, matchProduct } from './match';
import { meetsTarget } from './rules';
import type { DataAlert, Item, Line, MonthReport, Seller } from './types';

type Cell = string | number | boolean | Date | null;
type Rows = Cell[][];

/** Un dato de la hoja CALCULOS: meta y valor de un vendedor para un indicador. */
export interface CalcEntry {
  who: string;
  kind: 'sacos' | 'producto' | 'galones' | 'nuevos' | 'cartera';
  line: Line;
  product?: string;
  meta: number | null;
  real: number | null;
  /** true para la fila de total del equipo. */
  team?: boolean;
}

const up = (v: Cell | undefined) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim().toUpperCase();
const num = (v: Cell | undefined): number | null => (typeof v === 'number' ? v : null);
const isText = (v: Cell | undefined) => typeof v === 'string' && v.trim() !== '';

/**
 * Lee los bloques de CALCULOS. Cada bloque tiene una fila de encabezado que empieza con "VENDEDOR"
 * y un título en la fila de arriba ("Pegutil", "PRUVEN … Caucho", "TOTAL GALONES", "CLIENTES NUEVOS PRUVEN"…).
 */
export function parseCalculos(rows: Rows): CalcEntry[] {
  const out: CalcEntry[] = [];
  rows.forEach((row, r) =>
    (row ?? []).forEach((v, c) => {
      if (up(v) !== 'VENDEDOR') return;
      const titleTexts = [r - 1, r - 2].map((k) => (rows[k] ?? []).slice(c, c + 4).filter(isText).map((x) => String(x).trim())).find((t) => t.length) ?? [];
      const label = titleTexts.join(' ');
      const L = up(label);
      if (!L || /COBRANZA/.test(L)) return;
      const line: Line = /PRUVEN/.test(L) ? 'Pruven' : 'Pegutil';
      let kind: CalcEntry['kind'];
      let product: string | undefined;
      if (/GALONES/.test(L)) kind = 'galones';
      else if (/CLIENTES NUEVOS|NUEVOS CLIENTES/.test(L)) kind = 'nuevos';
      else if (/CARTERA/.test(L)) kind = 'cartera';
      else if (/PRUVEN/.test(L)) {
        kind = 'producto';
        // "PRUVEN | agosto | Caucho": el producto es el último texto del título (antes puede venir la fecha).
        product = titleTexts.length > 1 ? titleTexts[titleTexts.length - 1] : '';
        if (!product) return;
      } else if (/PEGUTIL/.test(L)) kind = 'sacos';
      else return;

      const hdr = (rows[r] ?? []).map(up);
      const span = [c + 1, c + 2, c + 3, c + 4];
      const metaCol = span.find((k) => /^META/.test(hdr[k] ?? ''));
      const realCol = kind === 'cartera' ? span.find((k) => hdr[k] === 'TOTAL') : span.find((k) => /^(VENTAS|LOGRADO)$/.test(hdr[k] ?? ''));
      if (realCol == null) return;

      let k = r + 1;
      for (; k < rows.length; k++) {
        const who = rows[k]?.[c];
        if (!isText(who)) break;
        const entry: CalcEntry = { who: String(who).trim(), kind, line, product, meta: metaCol != null ? num(rows[k][metaCol]) : null, real: num(rows[k][realCol]) };
        if (/^TOTAL/.test(up(who))) entry.team = true;
        out.push(entry);
      }
      // Fila de total sin etiqueta debajo de la lista (bloques de sacos y productos)
      const next = rows[k] ?? [];
      if (!isText(next[c]) && metaCol != null && num(next[metaCol]) != null && num(next[realCol]) != null && (kind === 'sacos' || kind === 'producto'))
        out.push({ who: 'TOTAL', kind, line, product, meta: num(next[metaCol]), real: num(next[realCol]), team: true });
    }),
  );
  return out;
}

const LABEL: Record<CalcEntry['kind'], string> = { sacos: 'sacos', producto: '', galones: 'galones', nuevos: 'nuevos clientes', cartera: 'atención de cartera' };

function sellerItem(s: Seller, e: CalcEntry): { meta: number | null; real: number | null; item?: Item } | null {
  const block = s.blocks.find((b) => b.line === e.line);
  if (e.kind === 'galones') return { meta: s.galones.meta, real: s.galones.real };
  if (!block) return null;
  let item: Item | undefined;
  if (e.kind === 'sacos') item = block.items.find((i) => /SACOS/i.test(i.name));
  else if (e.kind === 'producto') item = matchProduct(e.product ?? '', block.items);
  else if (e.kind === 'nuevos') item = block.items.find((i) => /NUEVOS CLIENTES/i.test(i.name));
  else item = block.items.find((i) => /CARTERA/i.test(i.name));
  return item ? { meta: item.obj, real: item.real, item } : null;
}

/** Compara CALCULOS con las hojas de vendedor y con RESULTADOS. */
export function checkCalculos(d: MonthReport, entries: CalcEntry[]): DataAlert[] {
  const alerts: DataAlert[] = [];
  const diff = (a: number | null, b: number | null) => a != null && b != null && Math.abs(a - b) > 0.005;
  const digits = (a: number | null, b: number | null) => (Number.isInteger(a) && Number.isInteger(b) ? 0 : 2);

  for (const e of entries) {
    const what = e.kind === 'producto' ? `ventas ${e.product?.toLowerCase()}` : LABEL[e.kind];
    if (e.team) {
      const R = d.results;
      if (!R || (e.kind !== 'sacos' && e.kind !== 'galones')) continue;
      if (diff(e.meta, R.meta[e.kind]))
        alerts.push({ level: 'warn', text: `Meta de ${what} del equipo: RESULTADOS dice ${fmt(R.meta[e.kind], 2)} y CALCULOS ${fmt(e.meta, 2)}.` });
      if (diff(e.real, R.total[e.kind]))
        alerts.push({ level: 'info', text: `Total de ${what} del equipo: RESULTADOS dice ${fmt(R.total[e.kind], 2)} y CALCULOS ${fmt(e.real, 2)}.` });
      continue;
    }
    const s = findSeller(d, e.who);
    if (!s) continue;
    const v = sellerItem(s, e);
    if (!v) continue;
    const where = `${s.display} · ${e.line === 'Pruven' && e.kind !== 'galones' ? 'Pruven, ' : ''}${what}`;
    if (e.kind !== 'cartera' && diff(v.meta, e.meta))
      alerts.push({ level: 'warn', text: `${where}: la meta es ${fmt(v.meta, digits(v.meta, e.meta))} en su hoja y ${fmt(e.meta, digits(v.meta, e.meta))} en CALCULOS.` });
    if (diff(v.real, e.real)) {
      // Importa más si con el otro valor cambia el cumplimiento, o si es un total (sacos o galones).
      let flips = false;
      if (v.item && v.item.obj) flips = meetsTarget(v.item, ((v.real ?? 0) / v.item.obj) * 100) !== meetsTarget(v.item, ((e.real ?? 0) / v.item.obj) * 100);
      const level: DataAlert['level'] = flips || e.kind === 'sacos' || e.kind === 'galones' ? 'warn' : 'info';
      alerts.push({ level, text: `${where}: ${fmt(v.real, digits(v.real, e.real))} en su hoja y ${fmt(e.real, digits(v.real, e.real))} en CALCULOS${flips ? '; con el valor de CALCULOS cambia el cumplimiento' : ''}.` });
    }
  }
  return alerts;
}
