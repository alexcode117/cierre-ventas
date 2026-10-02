import { analyze, type Analysis } from './analysis';
import { awardInsights, checkAwards, type AwardCheck } from './awards';
import { compare, validatePair, type Comparison } from './compare';
import { sha256 } from './hash';
import type { Insight, MonthReport } from './types';

export interface LoadedFile {
  name: string;
  size: number;
  hash: string;
  report: MonthReport;
}

export interface Session {
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

export function buildSession(cur: LoadedFile, prev: LoadedFile | null): Session {
  if (prev) {
    const problem = validatePair(cur.report, prev.report);
    if (problem) throw new Error(problem);
  }
  const analysis = analyze(cur.report);
  const comparison = prev ? compare(cur.report, prev.report) : null;
  const awards = checkAwards(cur.report, prev?.report ?? null);
  const ord = { crit: 0, warn: 1, good: 2, info: 3 } as const;
  const insights = [...(comparison?.insights ?? []), ...awardInsights(awards), ...analysis.insights].sort((a, b) => ord[a.sev] - ord[b.sev]);
  return { cur, prev, analysis, comparison, awards, insights, generatedAt: new Date() };
}
