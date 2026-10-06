import { analyze, type Analysis } from './analysis';
import { awardInsights, checkAwards, type AwardCheck } from './awards';
import { compare, validatePair, type Comparison } from './compare';
import { fmt } from './format';
import { sha256 } from './hash';
import { applyProcedure, basisDiffs, type BasisDiff } from './procedure';
import type { Basis, Insight, MonthReport } from './types';

export interface LoadedFile {
  name: string;
  size: number;
  hash: string;
  report: MonthReport;
}

export interface Session {
  /** Base de cálculo de puntos y estados de esta sesión. */
  basis: Basis;
  /** Archivos tal como se leyeron (base Excel), para cambiar de base sin volver a cargarlos. */
  source: { cur: LoadedFile; prev: LoadedFile | null };
  /** Líneas en las que el Excel y el procedimiento dan otro puntaje. */
  diffs: BasisDiff[];
  /** Archivos con los puntos en la base de la sesión. */
  cur: LoadedFile;
  prev: LoadedFile | null;
  analysis: Analysis;
  comparison: Comparison | null;
  awards: AwardCheck[];
  /** Hallazgos del mes, de la comparación y de los reconocimientos, ordenados por prioridad. */
  insights: Insight[];
  generatedAt: Date;
}

export async function loadFile(name: string, buf: ArrayBuffer): Promise<LoadedFile> {
  // El lector de Excel se descarga recién cuando se carga el primer archivo.
  const { parseFile } = await import('./parser');
  const [report, hash] = await Promise.all([Promise.resolve().then(() => parseFile(buf)), sha256(buf)]);
  return { name, size: buf.byteLength, hash, report };
}

export function buildSession(src: LoadedFile, srcPrev: LoadedFile | null, basis: Basis = 'procedimiento'): Session {
  if (srcPrev) {
    const problem = validatePair(src.report, srcPrev.report);
    if (problem) throw new Error(problem);
  }
  const conv = (f: LoadedFile): LoadedFile => (basis === 'procedimiento' ? { ...f, report: applyProcedure(f.report) } : f);
  const cur = conv(src);
  const prev = srcPrev ? conv(srcPrev) : null;
  const analysis = analyze(cur.report);
  const comparison = prev ? compare(cur.report, prev.report) : null;
  const awards = checkAwards(cur.report);
  const diffs = basisDiffs(basis === 'procedimiento' ? cur.report : applyProcedure(src.report));
  const ord = { crit: 0, warn: 1, good: 2, info: 3 } as const;
  const insights = [...(comparison?.insights ?? []), ...awardInsights(awards), ...basisInsights(diffs, basis), ...analysis.insights].sort((a, b) => ord[a.sev] - ord[b.sev]);
  return { basis, source: { cur: src, prev: srcPrev }, diffs, cur, prev, analysis, comparison, awards, insights, generatedAt: new Date() };
}

const STATUS_TXT = { PRODUCTIVO: 'Productivo', ESTABLE: 'Estable', CRITICO: 'Crítico' } as const;

function basisInsights(diffs: BasisDiff[], basis: Basis): Insight[] {
  if (!diffs.length) return [];
  const statusChanges = diffs.filter((d) => d.excelStatus !== d.procStatus);
  const list = diffs.map((d) => `${d.seller} ${d.line}: Excel ${fmt(d.excel, 1)} → procedimiento ${fmt(d.proc, 1)}${d.excelStatus !== d.procStatus ? ` (${STATUS_TXT[d.excelStatus]} → ${STATUS_TXT[d.procStatus]})` : ''}`);
  return [{
    sev: statusChanges.length ? 'warn' : 'info',
    title: `El Excel y el procedimiento de KPI's dan otro puntaje en ${diffs.length} ${diffs.length === 1 ? 'línea' : 'líneas'}`,
    body: `${list.join('; ')}. ${basis === 'procedimiento' ? 'El dashboard usa el procedimiento; el detalle está en la pestaña Procedimiento.' : 'El dashboard está mostrando los puntos del Excel; cambie a "Procedimiento" para ver la evaluación oficial.'}`,
    tags: ['Procedimiento'],
  }];
}
