import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/analysis';
import { checkAwards } from '../src/lib/awards';
import { matchProduct } from '../src/lib/match';
import { compare, validatePair } from '../src/lib/compare';
import { parseFile, ParseError } from '../src/lib/parser';

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
    expect(laura.blocks.map((b) => [b.line, b.score])).toEqual([['Pegutil', 12], ['Pruven', 11.5]]);
    expect(laura.status).toBe('PRODUCTIVO');
    expect(ago.sellers.find((s) => s.sheet === 'ZONA LLANOS')?.status).toBe('CRITICO');
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
    expect(a.insights.some((i) => /Ventas Oxido: falla en 4 de 4/.test(i.title))).toBe(true);
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
    expect(al?.text).toMatch(/pasa de 6 a 3 pts y de Estable a Crítico/);
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

  it('1.7 verifica reconocimientos: empates y mayor incremento con el mes anterior', () => {
    const solo = checkAwards(ago, null);
    expect(solo.find((c) => /NUEVOS CLIENTES/.test(c.award.criterio) && c.award.line === 'Pegutil')?.status).toBe('tie');
    expect(solo.find((c) => /INCREMENTO/.test(c.award.criterio))?.status).toBe('unverifiable');
    const conPrev = checkAwards(ago, jul);
    expect(conPrev.find((c) => /INCREMENTO/.test(c.award.criterio) && c.award.line === 'Pegutil')?.status).toBe('ok');
  });

  it('empareja productos por palabra completa', () => {
    const items = laura.blocks.find((b) => b.line === 'Pruven')!.items;
    expect(matchProduct('UTIL TOP', items)?.name).toBe('VENTAS UTIL TOP');
    expect(matchProduct('Caucho', items)?.name).toMatch(/CAUCHOS/);
    expect(matchProduct('Esmalte', items)?.name).toBe('VENTAS ESMALTES');
  });
});
