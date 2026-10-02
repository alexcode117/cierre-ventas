import { analyze, type Analysis } from './analysis';
import { compare, validatePair, type Comparison } from './compare';
import { sha256 } from './hash';
import type { MonthReport } from './types';

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
  return {
    cur,
    prev,
    analysis: analyze(cur.report),
    comparison: prev ? compare(cur.report, prev.report) : null,
    generatedAt: new Date(),
  };
}
