import * as XLSX from 'xlsx';
import { checkCalculos, parseCalculos } from './calculos';
import { fmt, monthKey, STATUS_LABEL } from './format';
import { RULES, rulePoints, statusOf, thresholdOf } from './rules';
import type { Award, Block, DataAlert, Item, Line, Metas, MonthReport, Results, Seller, Status, Zona } from './types';

type Cell = string | number | boolean | Date | null;
type Rows = Cell[][];

export class ParseError extends Error {}

const up = (v: Cell | undefined) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim().toUpperCase();
const num = (v: Cell | undefined): number | null => {
  if (typeof v === 'number') return v;
  if (v == null || v === '' || typeof v === 'boolean' || v instanceof Date) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isNaN(n) ? null : n;
};
const clean = (v: Cell | undefined) => String(v ?? '').replace(/\s+/g, ' ').trim();
const display = (sheet: string) => clean(sheet).toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

function findCell(rows: Rows, test: (v: string) => boolean): [number, number] | null {
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] ?? [];
    for (let c = 0; c < row.length; c++) if (test(up(row[c]))) return [r, c];
  }
  return null;
}

/** Lee un ArrayBuffer de Excel y lo convierte en el modelo del mes. */
export function parseFile(buf: ArrayBuffer): MonthReport {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: 'array' });
  } catch {
    throw new ParseError('El archivo no es un Excel válido o está dañado.');
  }
  return parseWorkbook(wb);
}

export function parseWorkbook(wb: XLSX.WorkBook): MonthReport {
  const out: MonthReport = { month: null, key: null, sellers: [], results: null, awards: [], metas: null, alerts: [] };
  let calcRows: Rows | null = null;
  let legend: string[] | null = null;

  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[name], { header: 1, defval: null, raw: true });
    const n = up(name);
    if (/CALCULO/.test(n)) {
      calcRows = rows;
      continue;
    }
    if (/RESULTADO/.test(n)) {
      parseResults(rows, out);
      continue;
    }
    if (/^METAS?\b/.test(n)) {
      out.metas = parseMetas(rows);
      continue;
    }
    const s = parseSeller(name, rows);
    if (s) {
      out.sellers.push(s);
      legend ??= readLegend(rows);
    }
  }

  if (!out.sellers.length && !out.results) {
    throw new ParseError('No se encontraron hojas de vendedor (con la columna "INDICADOR") ni la hoja RESULTADOS.');
  }
  out.key = monthKey(out.month);
  checkConsistency(out);
  if (calcRows) out.alerts.push(...checkCalculos(out, parseCalculos(calcRows)));
  if (legend)
    out.alerts.push({ level: 'info', text: `La leyenda del Excel dice ${legend.join(', ')}, y deja sin clasificar el 3 y los puntajes entre 9 y 10. La herramienta usa: Productivo desde ${RULES.productivo}, Estable desde ${RULES.estable}, Crítico por debajo de ${RULES.estable}.` });
  out.sellers.sort((a, b) => b.total - a.total);
  return out;
}

function parseSeller(sheet: string, rows: Rows): Seller | null {
  const heads: [number, number][] = [];
  rows.forEach((row, r) => (row ?? []).forEach((v, c) => up(v) === 'INDICADOR' && heads.push([r, c])));
  if (!heads.length) return null;

  const blocks: Block[] = [];
  const galones: Seller['galones'] = { meta: null, real: null };
  let sellerTitle: string | null = null;

  heads.forEach(([hr, hc], bi) => {
    const hdr = (rows[hr] ?? []).map(up);
    const col = (k: string) => hdr.findIndex((h) => h === k);
    const ci = { obj: col('OBJETIVO'), real: col('REAL'), pct: col('%'), ok: col('CUMPLE'), pts: col('VALORACION') };

    let title: string | null = null;
    for (let r = hr - 1; r >= Math.max(0, hr - 4); r--) {
      const t = rows[r]?.[hc];
      if (t && /INDICADORES/i.test(String(t)) && /\(/.test(String(t))) {
        title = clean(t);
        break;
      }
    }
    sellerTitle ??= title;

    const items: Item[] = [];
    let r = hr + 1;
    for (; r < rows.length; r++) {
      const row = rows[r] ?? [];
      if (!up(row[hc])) break;
      const obj = num(row[ci.obj]);
      const real = num(row[ci.real]);
      let pct = num(row[ci.pct]);
      if (pct == null && obj) pct = ((real ?? 0) / obj) * 100;
      items.push({ name: clean(row[hc]), obj, real, pct, ok: up(row[ci.ok]) === 'SI', pts: num(row[ci.pts]) ?? 0 });
    }
    const stated = num(rows[r]?.[ci.pts]);
    const sum = items.reduce((a, b) => a + b.pts, 0);
    const line: Line = items.some((i) => /PRUVEN|CAUCHO|ESMALTE|MANTUTIL|OXIDO|ÓXIDO/i.test(i.name)) ? 'Pruven' : 'Pegutil';
    const declaredRaw = title?.match(/\(\s*(PRODUCTIVO|ESTABLE|CR[IÍ]TICO)\s*\)/i)?.[1];
    const declared = declaredRaw ? (up(declaredRaw).replace('Í', 'I') as Status) : null;
    const score = stated ?? sum;
    blocks.push({ line, title, items, score, sum, stated, declared, status: statusOf(score) });

    if (bi === heads.length - 1) {
      for (let k = r; k < Math.min(rows.length, r + 8); k++) {
        const lab = up(rows[k]?.[hc]);
        const v = num(rows[k]?.[hc + 1]);
        if (lab === 'META') galones.meta = v;
        else if (lab === 'VENTAS') galones.real = v;
      }
    }
  });

  const sacosItem = blocks.find((b) => b.line === 'Pegutil')?.items.find((i) => /SACOS/i.test(i.name));
  const total = blocks.reduce((a, b) => a + b.score, 0);
  return {
    sheet: clean(sheet),
    display: display(sheet),
    title: sellerTitle,
    zona: null,
    blocks,
    sacos: { meta: sacosItem?.obj ?? null, real: sacosItem?.real ?? null },
    galones,
    total,
    status: statusOf(total / blocks.length),
  };
}

/** Leyenda de estados que algunas hojas traen a la derecha ("PRODUCTIVO | MAYOR A DE 10 PUNTOS"). */
function readLegend(rows: Rows): string[] | null {
  const items: string[] = [];
  for (const st of ['PRODUCTIVO', 'ESTABLE', 'CRITICO']) {
    const at = findCell(rows, (v) => v === st);
    const txt = at ? clean(rows[at[0]][at[1] + 1]).replace(/\s*PUNTOS?/i, '').toLowerCase() : '';
    if (!txt) return null;
    items.push(`${STATUS_LABEL[st as Status]} "${txt.replace(/ de (\d)/, ' $1')}"`);
  }
  return items;
}

function parseResults(rows: Rows, out: MonthReport) {
  const t = findCell(rows, (v) => /^RESULTADOS\s/.test(v));
  if (t) out.month = clean(rows[t[0]][t[1]]).replace(/RESULTADOS/i, '').trim();

  const h = findCell(rows, (v) => v === 'ZONA');
  if (h) {
    const [hr, hc] = h;
    const zonas: Zona[] = [];
    let total: Results['total'] = { sacos: null, galones: null };
    let meta: Results['meta'] = { sacos: null, galones: null };
    for (let r = hr + 1; r < rows.length; r++) {
      const row = rows[r] ?? [];
      const z = up(row[hc]);
      if (!z) continue;
      if (z === 'TOTAL') total = { sacos: num(row[hc + 2]), galones: num(row[hc + 3]) };
      else if (z === 'META') meta = { sacos: num(row[hc + 2]), galones: num(row[hc + 3]) };
      else if (/ALCANZADO/.test(z)) break;
      else zonas.push({ zona: clean(row[hc]), vendedor: clean(row[hc + 1]), sacos: num(row[hc + 2]), galones: num(row[hc + 3]), sheet: null });
    }
    if (total.sacos == null) {
      total = {
        sacos: zonas.reduce((a, z) => a + (z.sacos ?? 0), 0),
        galones: zonas.reduce((a, z) => a + (z.galones ?? 0), 0),
      };
    }
    out.results = { zonas, total, meta };
  }

  rows.forEach((row, r) =>
    (row ?? []).forEach((v, c) => {
      if (!/^VARIABLE/.test(up(v))) return;
      const line: Line = /PRUVEN/.test(up(v)) ? 'Pruven' : 'Pegutil';
      for (let k = r + 1; k < rows.length; k++) {
        const crit = rows[k]?.[c];
        if (!up(crit)) break;
        out.awards.push({ line, criterio: clean(crit), ejecutivo: clean(rows[k][c + 1]), pct: num(rows[k][c + 2]) } satisfies Award);
      }
    }),
  );
}

function parseMetas(rows: Rows): Metas | null {
  const t = findCell(rows, (v) => /^METAS/.test(v));
  const h = findCell(rows, (v) => v === 'VENDEDOR');
  if (!h) return null;
  const [hr, hc] = h;
  const cols = (rows[hr] ?? []).slice(hc + 1).map((x) => (x == null ? '' : /C[LI]*IENTES/i.test(String(x)) ? 'Clientes nuevos' : clean(x)));
  while (cols.length && !cols[cols.length - 1]) cols.pop();
  const list: Metas['rows'] = [];
  for (let r = hr + 1; r < rows.length; r++) {
    const row = rows[r] ?? [];
    if (row[hc] == null || !up(row[hc])) continue;
    list.push({ vendedor: clean(row[hc]), values: cols.map((_, i) => num(row[hc + 1 + i])) });
  }
  return { title: t ? clean(rows[t[0]][t[1]]) : 'Metas', cols, rows: list };
}

/** Cruza hojas de vendedor con RESULTADOS y registra lo que no cuadra. */
function checkConsistency(out: MonthReport) {
  const add = (level: DataAlert['level'], text: string) => out.alerts.push({ level, text });
  const zonas = out.results?.zonas ?? [];

  for (const s of out.sellers) {
    const tok = up(s.sheet).split(' ')[0];
    let z = zonas.find((z) => up(z.vendedor).includes(tok) || up(z.zona).includes(tok));
    if (!z && s.sacos.real != null) z = zonas.find((z) => z.sacos === s.sacos.real);
    if (z) {
      s.zona = z.zona;
      z.sheet = s.sheet;
      if (s.sacos.real != null && z.sacos != null && s.sacos.real !== z.sacos)
        add('warn', `${s.display}: la hoja reporta ${fmt(s.sacos.real)} sacos y RESULTADOS dice ${fmt(z.sacos)}.`);
      if (s.galones.real != null && z.galones != null && Math.abs(s.galones.real - z.galones) > 0.01)
        add(Math.abs(s.galones.real - z.galones) > 50 ? 'crit' : 'warn', `${s.display}: la hoja reporta ${fmt(s.galones.real, 2)} galones y RESULTADOS dice ${fmt(z.galones, 2)}.`);
    }
    for (const b of s.blocks) {
      if (b.stated != null && Math.abs(b.stated - b.sum) > 0.01)
        add('warn', `${s.display} · ${b.line}: el total (${fmt(b.stated, 1)}) no coincide con la suma de valoraciones (${fmt(b.sum, 1)}).`);
      if (b.declared && b.declared !== b.status)
        add('info', `${s.display} · ${b.line}: el título dice ${b.declared} pero ${fmt(b.score, 1)} puntos corresponde a ${b.status}.`);
      // CUMPLE del Excel que contradice la regla: cambia puntos, así que nunca es solo una nota.
      const wrong = b.items.filter((i) => i.pct != null && rulePoints(b, i) !== i.pts);
      if (wrong.length) {
        const ruleScore = b.items.reduce((a, i) => a + rulePoints(b, i), 0);
        const ruleStatus = statusOf(ruleScore);
        const list = wrong.map((i) => `${i.name} al ${fmt(i.pct, 1)}% recibe ${fmt(i.pts, 1)} pts (umbral ${thresholdOf(i)}%)`).join('; ');
        add(ruleStatus !== b.status ? 'crit' : 'warn',
          `${s.display} · ${b.line}: el Excel asigna puntos que no corresponden a la regla (${list}). Con la regla, ${b.line} pasa de ${fmt(b.score, 1)} a ${fmt(ruleScore, 1)} pts${ruleStatus !== b.status ? ` y de ${STATUS_LABEL[b.status]} a ${STATUS_LABEL[ruleStatus]}` : ''}.`);
      }
    }
  }
  for (const z of zonas) if (!z.sheet) add('info', `${z.vendedor && z.vendedor !== '-' ? z.vendedor : z.zona} aparece en RESULTADOS pero no tiene hoja de indicadores.`);
  if (out.results?.zonas.length) {
    const sum = out.results.zonas.reduce((a, z) => a + (z.sacos ?? 0), 0);
    if (out.results.total.sacos != null && Math.abs(sum - out.results.total.sacos) > 0.5)
      add('warn', `RESULTADOS: el total de sacos (${fmt(out.results.total.sacos)}) no coincide con la suma por zona (${fmt(sum)}).`);
  }
  // Meta del equipo frente a la suma de metas individuales
  for (const key of ['sacos', 'galones'] as const) {
    const meta = out.results?.meta[key];
    const linked = out.sellers.filter((s) => s.zona && s[key].meta != null);
    if (!meta || !linked.length) continue;
    const sum = linked.reduce((a, s) => a + (s[key].meta ?? 0), 0);
    const sinHoja = zonas.filter((z) => !z.sheet).map((z) => (z.vendedor && z.vendedor !== '-' ? z.vendedor : z.zona));
    if (Math.abs(meta - sum) <= 0.5) continue;
    if (Math.abs(meta - sum) <= Math.max(meta, sum) * 0.05)
      add('warn', `La meta de ${key} del equipo en RESULTADOS (${fmt(meta)}) no coincide con la suma de las metas de las hojas de vendedor (${fmt(sum)}).`);
    else if (meta > sum)
      add('info', `La meta de ${key} del equipo (${fmt(meta)}) es mayor que la suma de las metas de las hojas (${fmt(sum)}): se asume que incluye ${sinHoja.length ? `a ${sinHoja.join(', ')}` : 'a vendedores sin hoja'}.`);
  }
  if (!out.results) add('warn', 'No se encontró la hoja RESULTADOS: los totales del equipo se calculan solo con las hojas de vendedor.');
  if (!out.metas) add('info', 'No se encontró la hoja METAS: no se evalúan las metas del próximo mes.');
  if (!out.month) add('warn', 'No se encontró el mes en RESULTADOS (celda "RESULTADOS <MES> <AÑO>"): no se puede validar la comparación.');
}
