import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/analysis';
import { checkAwards } from '../src/lib/awards';
import { matchProduct } from '../src/lib/match';
import { compare, validatePair } from '../src/lib/compare';
import * as XLSX from 'xlsx';
import { parseFile, parseWorkbook, ParseError } from '../src/lib/parser';
import { applyProcedure, basisDiffs } from '../src/lib/procedure';
import { pctDiffers } from '../src/lib/awards';
import { buildSession, type LoadedFile } from '../src/lib/load';
import { rulePoints, scoreAt, sellerStatus, statusOf, tierPoints } from '../src/lib/rules';

const load = (f: string) => {
  const b = readFileSync(`public/ejemplos/${f}`);
  return parseFile(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
};
const ago = load('ejemplo-agosto-2026.xlsx');
const jul = load('ejemplo-julio-2026.xlsx');

describe('parser', () => {
  it('lee el mes, los vendedores y los totales', () => {
    expect(ago.month).toBe('AGOSTO 2026');
    expect(ago.key).toBe('2026-08');
    expect(ago.sellers.map((s) => s.display)).toEqual(['Laura Mendez', 'Mario Torrealba', 'Patricia Yanez', 'Zona Llanos']);
    expect(ago.results?.zonas).toHaveLength(5);
    expect(ago.results?.meta.sacos).toBe(16800);
    expect(ago.awards).toHaveLength(8);
    expect(ago.metas?.rows.at(-1)?.vendedor).toBe('Meta General');
  });

  it('calcula puntajes y estados por línea', () => {
    const laura = ago.sellers[0];
    expect(laura.blocks.map((b) => [b.line, b.score])).toEqual([['Pegutil', 11], ['Pruven', 10.5]]);
    expect(laura.status).toBe('PRODUCTIVO');
    expect(ago.sellers.find((s) => s.sheet === 'ZONA LLANOS')?.status).toBe('ESTABLE'); // 3,5 y 5 pts: promedio 4,25
  });

  it('detecta las inconsistencias sembradas en el ejemplo', () => {
    const t = ago.alerts.map((a) => a.text).join('\n');
    expect(t).toMatch(/Patricia Yanez: la hoja reporta 2\.510 sacos y RESULTADOS dice 2\.632/);
    expect(t).toMatch(/Zona Llanos: la hoja reporta 568,1 galones/);
    expect(t).toMatch(/Daniela Chirinos aparece en RESULTADOS/);
    expect(t).toMatch(/VENTAS \(SACOS\) al 89,6% recibe 3 pts/);
    expect(ago.alerts.find((a) => /Zona Llanos/.test(a.text))?.level).toBe('crit');
  });

  it('rechaza archivos que no tienen el formato', () => {
    expect(() => parseFile(new TextEncoder().encode('hola').buffer as ArrayBuffer)).toThrow(ParseError);
  });
});

describe('análisis', () => {
  const a = analyze(ago);
  it('genera hallazgos priorizados', () => {
    expect(a.insights.length).toBeGreaterThan(4);
    expect(a.insights[0].sev).toBe('crit');
    expect(a.insights.some((i) => /Cobranza: falla en 4 de 4/.test(i.title))).toBe(true);
  });
  it('evalúa las metas del próximo mes', () => {
    expect(a.plan.find((p) => p.vendedor === 'Llanos')?.risk).toBe('alto');
    expect(a.plan.find((p) => p.vendedor === 'Laura')?.risk).toBe('bajo');
  });
  it('calcula la venta cruzada del equipo', () => {
    expect(a.teamCross).toBeCloseTo(((1328.5 + 924.2 + 568.1 + 243.8 + 561.2) / (6120 + 5210 + 2632 + 2180 + 4410)) * 100, 3);
  });
});

describe('comparación', () => {
  it('valida el orden de los archivos', () => {
    expect(validatePair(ago, jul)).toBeNull();
    expect(validatePair(jul, ago)).toMatch(/más reciente/);
    expect(validatePair(ago, ago)).toMatch(/mismo mes/);
  });
  it('calcula variaciones por vendedor y del equipo', () => {
    const c = compare(ago, jul);
    expect(c.sellers.size).toBe(4);
    expect(c.team.sacos.prev).toBe(5480 + 4890 + 2940 + 2450 + 4120);
    expect(c.insights.some((i) => /Frente a Julio/.test(i.title))).toBe(true);
    expect(c.insights.some((i) => /dos meses seguidos/.test(i.title))).toBe(true);
  });
});

// Casos del informe de auditoría (inconsistencias_cierre_agosto_2026.md)
describe('auditoría', () => {
  const a = analyze(ago);
  const laura = ago.sellers.find((s) => s.sheet === 'LAURA MENDEZ')!;
  const pru = (n: string) => laura.blocks.find((b) => b.line === 'Pruven')!.items.find((i) => i.name.includes(n))!.real!;

  it('1.1 la meta Pruven suma Util Top, no Mantutil dos veces', () => {
    const expected = ['CAUCHOS', 'MANTUTIL', 'ESMALTES', 'UTIL TOP', 'METYLUTIL', 'OXIDO'].reduce((s, n) => s + pru(n), 0);
    expect(a.plan.find((p) => p.vendedor === 'Laura')?.realP).toBeCloseTo(expected, 6);
  });

  it('1.2 el % de galones compara ventas y meta de la misma base', () => {
    expect(a.team.galones.excluded.map((z) => z.vendedor)).toEqual(['Daniela Chirinos']);
    expect(a.team.galones.sold).toBeCloseTo(1328.5 + 924.2 + 2 * 0 + 568.1 + 243.8, 6);
    expect(a.galonesPct).toBeCloseTo(((1328.5 + 924.2 + 568.1 + 243.8) / 4290) * 100, 6);
    // La meta de sacos del equipo es mayor que la suma de las hojas: incluye a Daniela y se usa el total.
    expect(a.team.sacos.excluded).toEqual([]);
  });

  it('1.3 un CUMPLE que contradice la regla y cambia el estado es crítico', () => {
    const al = ago.alerts.find((x) => /Patricia Yanez · Pegutil: el Excel asigna puntos/.test(x.text));
    expect(al?.level).toBe('crit');
    expect(al?.text).toMatch(/COBRANZA META PEGUTIL al 80% recibe 3 pts y le corresponden 1/);
    expect(al?.text).toMatch(/pasa de 10 a 6 pts y de Productivo a Estable/);
  });

  it('1.5 lee CALCULOS y detecta sus diferencias', () => {
    const t = ago.alerts.map((x) => x.text).join('\n');
    expect(t).toMatch(/Patricia Yanez · sacos: la meta es 2\.800 en su hoja y 2\.900 en CALCULOS/);
    expect(t).toMatch(/Zona Llanos · Pruven, ventas esmalte: 38,75 en su hoja y 33,75 en CALCULOS/);
    expect(t).toMatch(/Mario Torrealba · galones: la meta es 1\.100 en su hoja y 1\.000 en CALCULOS/);
  });

  it('1.6 documenta la leyenda de estados del Excel', () => {
    expect(ago.alerts.some((x) => /leyenda del Excel/.test(x.text))).toBe(true);
  });

  it('1.7 verifica reconocimientos: empates y mayor incremento contra la meta', () => {
    const checks = checkAwards(ago);
    expect(checks.find((c) => c.key === 'ANC' && c.award.line === 'Pegutil')?.status).toBe('tie');
    // El procedimiento mide el incremento contra la meta: no hace falta el mes anterior.
    expect(checks.find((c) => c.key === 'CV' && c.award.line === 'Pegutil')?.status).toBe('ok');
  });

  it('empareja productos por palabra completa', () => {
    const items = laura.blocks.find((b) => b.line === 'Pruven')!.items;
    expect(matchProduct('UTIL TOP', items)?.name).toBe('VENTAS UTIL TOP');
    expect(matchProduct('Caucho', items)?.name).toMatch(/CAUCHOS/);
    expect(matchProduct('Esmalte', items)?.name).toBe('VENTAS ESMALTES');
  });
});

// Procedimiento para cálculo de KPI's e incentivos para ventas (08/01/2025)
describe("procedimiento de KPI's", () => {
  const proc = applyProcedure(ago);
  const seller = (sheet: string) => proc.sellers.find((s) => s.sheet === sheet)!;
  const kpi = (sheet: string, line: string, k: string) => seller(sheet).blocks.find((b) => b.line === line)!.items.find((i) => i.kpi === k)!;

  it('puntúa por tramos 3/2/1/0 (nuevos clientes 3/1,5/0)', () => {
    expect(kpi('LAURA MENDEZ', 'Pegutil', 'CT').pts).toBe(2); // cobranza 95% → 2 pts, igual que el Excel
    expect(kpi('LAURA MENDEZ', 'Pegutil', 'CT').excelPts).toBe(2);
    expect(kpi('PATRICIA YANEZ', 'Pegutil', 'CV').pts).toBe(1); // sacos 89,6% → 1 pt (el Excel sembrado da 3)
    expect(kpi('PATRICIA YANEZ', 'Pegutil', 'CV').excelPts).toBe(3);
    expect(kpi('ZONA LLANOS', 'Pegutil', 'CV').pts).toBe(0); // 62% → 0
    expect(kpi('PATRICIA YANEZ', 'Pegutil', 'CT').pts).toBe(1); // 80% → 1
    expect(kpi('ZONA LLANOS', 'Pegutil', 'ANC').pts).toBe(1.5); // 50% → 1,5
    expect(tierPoints('AC', 65)).toBe(2);
    expect(tierPoints('ANC', 75)).toBe(1.5);
    expect(tierPoints('CV', 79.9)).toBe(0);
  });

  it('mide atención de cartera contra su objetivo, como el Excel', () => {
    const ac = kpi('LAURA MENDEZ', 'Pegutil', 'AC');
    expect(ac.obj).toBe(43.4);
    expect(ac.pct).toBeCloseTo((47 / 43.4) * 100, 6);
    expect(ac.pts).toBe(3);
    expect(kpi('PATRICIA YANEZ', 'Pegutil', 'AC').pts).toBe(1); // 25 de 42 = 59,5% → 1
    expect(kpi('ZONA LLANOS', 'Pegutil', 'AC').pts).toBe(0); // 45,1% → 0
  });

  it('en el Excel, cada producto Pruven vale 0,5 desde el 80% de su meta', () => {
    const pru = ago.sellers.find((s) => s.sheet === 'LAURA MENDEZ')!.blocks.find((b) => b.line === 'Pruven')!;
    const oxido = pru.items.find((i) => /OXIDO/.test(i.name))!; // 62 de 144 = 43%
    expect(rulePoints(pru, oxido)).toBe(0);
    expect(scoreAt(pru, oxido, 80)).toBe(0.5);
    expect(scoreAt(pru, oxido, 79.9)).toBe(0);
  });

  it('mide Pruven por galones totales y deja los productos como informativos', () => {
    const cv = kpi('LAURA MENDEZ', 'Pruven', 'CV');
    expect(cv.pct).toBeCloseTo((1328.5 / 1150) * 100, 6);
    expect(cv.pts).toBe(3);
    const prods = seller('LAURA MENDEZ').blocks.find((b) => b.line === 'Pruven')!.items.filter((i) => i.kpi === 'PROD');
    expect(prods).toHaveLength(6);
    expect(prods.every((p) => p.pts === 0 && p.max === 0)).toBe(true);
  });

  it('usa los umbrales de estado del procedimiento y registra las diferencias con el Excel', () => {
    const laura = seller('LAURA MENDEZ');
    expect(laura.blocks.map((b) => b.score)).toEqual([11, 11]);
    expect(laura.blocks.every((b) => b.status === 'PRODUCTIVO')).toBe(true);
    expect(basisDiffs(proc).length).toBeGreaterThan(0);
  });

  it('valida los incentivos contra la tabla oficial', () => {
    const checks = checkAwards(proc);
    expect(checks.find((c) => c.key === 'CV' && c.award.line === 'Pruven' && pctDiffers(c))?.officialPct).toBe(0.7); // el Excel paga 0,6
    expect(checks.some((c) => c.key === 'CV' && c.award.line === 'Pegutil' && pctDiffers(c))).toBe(false);
    expect(checks.filter((c) => c.status === 'missing')).toEqual([]); // "Mejor manejo de variables" no se usa
  });

  it('arma la sesión en la base pedida', () => {
    const b = readFileSync('public/ejemplos/ejemplo-agosto-2026.xlsx');
    const f: LoadedFile = { name: 'x', size: b.length, hash: '', report: ago };
    expect(buildSession(f, null).cur.report.basis).toBe('procedimiento');
    expect(buildSession(f, null, 'excel').cur.report.basis).toBe('excel');
  });
});

describe('escala de estados', () => {
  it('Productivo más de 9, Estable más de 3 y hasta 9, Crítico 3 o menos, en las dos bases', () => {
    for (const basis of ['procedimiento', 'excel'] as const) {
      expect(statusOf(12, basis)).toBe('PRODUCTIVO');
      expect(statusOf(9.5, basis)).toBe('PRODUCTIVO');
      expect(statusOf(9, basis)).toBe('ESTABLE');
      expect(statusOf(3.5, basis)).toBe('ESTABLE');
      expect(statusOf(3, basis)).toBe('CRITICO');
      expect(statusOf(0, basis)).toBe('CRITICO');
    }
  });
});

describe('observaciones de octubre', () => {
  const buf = (f: string) => { const b = readFileSync(`public/ejemplos/${f}`); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer; };

  it('si el título de RESULTADOS quedó de otro mes, toma el del nombre del archivo y avisa', () => {
    const r = parseFile(buf('ejemplo-agosto-2026.xlsx'), 'cierre octubre 2026.xlsx');
    expect(r.month).toBe('OCTUBRE 2026');
    expect(r.key).toBe('2026-10');
    expect(r.alerts.some((a) => a.level === 'warn' && /RESULTADOS dice "AGOSTO 2026"/.test(a.text))).toBe(true);
    // Sin mes en el nombre, METAS (septiembre) confirma agosto: no hay aviso.
    const ok = parseFile(buf('ejemplo-agosto-2026.xlsx'), 'INDICADORES.xlsx');
    expect(ok.month).toBe('AGOSTO 2026');
    expect(ok.alerts.some((a) => /título de RESULTADOS/.test(a.text))).toBe(false);
  });

  it('sin mes en el nombre, deduce el mes de la hoja METAS', () => {
    const wb = XLSX.read(buf('ejemplo-agosto-2026.xlsx'));
    XLSX.utils.sheet_add_aoa(wb.Sheets.METAS, [[null, 'METAS MES NOVIEMBRE']], { origin: 'A1' });
    const r = parseWorkbook(wb, 'INDICADORES.xlsx');
    expect(r.month).toBe('OCTUBRE 2026');
  });

  it('lee hojas nuevas con encabezados escritos distinto y avisa de las que no reconoce', () => {
    const wb = XLSX.read(buf('ejemplo-agosto-2026.xlsx'));
    const laura = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets['LAURA MENDEZ'], { header: 1, defval: null });
    const ana = laura.map((row) => row.map((v) => (v === 'INDICADOR' ? 'INDICADORES' : v === 'VALORACION' ? 'VALORACIÓN' : v)));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ana), 'ANA RIVAS');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Vendedor nuevo', 'Ventas'], ['Pedro', 10]]), 'PEDRO');
    const r = parseWorkbook(wb, 'ejemplo-agosto-2026.xlsx');
    const s = r.sellers.find((x) => x.sheet === 'ANA RIVAS');
    expect(s?.sacos.meta).toBe(3500);
    expect(s?.blocks[0].score).toBeGreaterThan(0);
    expect(r.alerts.some((a) => /La hoja "PEDRO" no se leyó/.test(a.text))).toBe(true);
  });

  it('cobranza, cartera y nuevos clientes se premian por valor absoluto', () => {
    const checks = checkAwards(ago);
    const ct = (line: string) => checks.find((c) => c.key === 'CT' && c.award.line === line)!;
    expect(ct('Pegutil').status).toBe('ok');
    expect(ct('Pruven').status).toBe('mismatch');
    expect(ct('Pruven').detail).toMatch(/gana Mario Torrealba \(6\.480,75 cobrados\)/);
    const ac = checks.find((c) => c.key === 'AC' && c.award.line === 'Pegutil')!;
    expect(ac.detail).toMatch(/58 clientes atendidos/);
    expect(checks.find((c) => c.key === 'ANC' && c.award.line === 'Pegutil')!.status).toBe('tie');
  });
});

describe('estado del vendedor', () => {
  it('es el mejor de sus líneas: 10 en una línea basta para Productivo', () => {
    expect(sellerStatus([{ status: 'PRODUCTIVO' }, { status: 'ESTABLE' }])).toBe('PRODUCTIVO');
    expect(sellerStatus([{ status: statusOf(10) }, { status: statusOf(8) }])).toBe('PRODUCTIVO');
    expect(sellerStatus([{ status: 'CRITICO' }, { status: 'ESTABLE' }])).toBe('ESTABLE');
    expect(sellerStatus([{ status: 'CRITICO' }, { status: 'CRITICO' }])).toBe('CRITICO');
  });
});
