import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze } from '../src/lib/analysis';
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
    expect(t).toMatch(/marcado "SI" con 89,6%/);
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
