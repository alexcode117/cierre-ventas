import { fmt, titleCase } from './format';
import { findSeller } from './match';
import { INCENTIVES, RULES } from './rules';
import type { Award, Insight, KpiKey, Line, MonthReport, Seller } from './types';

export type AwardStatus = 'ok' | 'tie' | 'mismatch' | 'unverifiable' | 'missing';
type AwardKey = Exclude<KpiKey, 'PROD'>;

export interface AwardCheck {
  award: Award;
  key: AwardKey | null;
  status: AwardStatus;
  detail: string;
  /** % de incentivo que fija el procedimiento para este premio. */
  officialPct: number | null;
}

export const AWARD_STATUS_LABEL: Record<AwardStatus, string> = {
  ok: 'Coincide',
  tie: 'Empate',
  mismatch: 'No coincide',
  unverifiable: 'No verificable',
  missing: 'Falta en el Excel',
};

function keyOf(criterio: string): AwardKey | null {
  const c = criterio.toUpperCase();
  if (/INCREMENTO|CRECIMIENTO/.test(c)) return 'CV';
  if (/COBRANZA/.test(c)) return 'CT';
  if (/CARTERA/.test(c)) return 'AC';
  if (/NUEVOS CLIENTES|ACTIVACI/.test(c)) return 'ANC';
  return null;
}

/** % logrado de un indicador del procedimiento, tanto en el informe del Excel como en el del procedimiento. */
export function kpiPct(s: Seller, line: Line, key: Exclude<KpiKey, 'PROD'>): number | null {
  const b = s.blocks.find((x) => x.line === line);
  if (!b) return null;
  const k = b.items.find((i) => i.kpi === key);
  if (k) return k.pct;
  const pct = (real: number | null | undefined, obj: number | null | undefined) => (obj ? ((real ?? 0) / obj) * 100 : null);
  const find = (re: RegExp) => b.items.find((i) => re.test(i.name));
  if (key === 'CV') return line === 'Pegutil' ? find(/SACOS/)?.pct ?? null : pct(s.galones.real, s.galones.meta);
  if (key === 'CT') return find(/COBRANZA/)?.pct ?? null;
  if (key === 'ANC') return find(/NUEVOS CLIENTES/)?.pct ?? null;
  const c = find(/CARTERA/);
  return c?.obj ? pct(c.real, c.obj / RULES.carteraObjetivo) : null;
}

const METRIC: Record<AwardKey, { label: string; show: (v: number) => string }> = {
  CV: { label: 'crecimiento en ventas sobre la meta', show: (v) => `${fmt(v, 1)}%` },
  CT: { label: 'cobranza a tiempo', show: (v) => `${fmt(v)}%` },
  AC: { label: 'atención de cartera', show: (v) => `${fmt(v, 1)}% de la cartera` },
  ANC: { label: 'activación de nuevos clientes', show: (v) => `${fmt(v)}% de la meta` },
};

function leaders(report: MonthReport, line: Line, key: AwardKey) {
  const value = (s: Seller): number | null => kpiPct(s, line, key);
  const vals = report.sellers.map((s) => ({ s, v: value(s) })).filter((x): x is { s: Seller; v: number } => x.v != null);
  if (!vals.length) return null;
  const best = Math.max(...vals.map((x) => x.v));
  return { vals, best, top: vals.filter((x) => Math.abs(x.v - best) < 1e-9).map((x) => x.s) };
}

/**
 * Contrasta los reconocimientos de RESULTADOS con el Procedimiento de KPI's: quién debería ganar cada
 * premio según los datos, si el % de incentivo es el oficial y si falta algún premio de la tabla.
 */
export function checkAwards(report: MonthReport): AwardCheck[] {
  const checks: AwardCheck[] = report.awards.map((award) => {
    const key = keyOf(award.criterio);
    const official = key ? INCENTIVES[award.line].find((x) => x.key === key)?.pct ?? null : null;
    const base = { award, key, officialPct: official };
    if (!key) return { ...base, status: 'unverifiable', detail: 'Criterio no reconocido en el procedimiento.' };
    const m = METRIC[key];
    const l = leaders(report, award.line, key);
    if (!l) return { ...base, status: 'unverifiable', detail: `No hay datos de ${m.label}.` };
    const winner = findSeller(report, award.ejecutivo);
    const names = l.top.map((s) => s.display).join(' y ');
    if (!winner) return { ...base, status: 'mismatch', detail: `"${titleCase(award.ejecutivo)}" no coincide con ninguna hoja de vendedor. Según el procedimiento gana ${names} (${m.show(l.best)}).` };
    if (key === 'CV' && l.best < 100) return { ...base, status: 'mismatch', detail: `Nadie superó la meta (mejor: ${names} con ${m.show(l.best)}); el procedimiento asigna este incentivo solo por encima del 100%.` };
    if (l.top.includes(winner)) {
      if (l.top.length > 1) return { ...base, status: 'tie', detail: `Empate en ${m.label}: ${names} con ${m.show(l.best)}. El procedimiento no define desempate.` };
      return { ...base, status: 'ok', detail: `${winner.display} tiene el mejor resultado en ${m.label} (${m.show(l.best)}).` };
    }
    const wv = l.vals.find((x) => x.s === winner)?.v;
    return { ...base, status: 'mismatch', detail: `Según el procedimiento gana ${names} (${m.show(l.best)}); ${winner.display} tiene ${wv != null ? m.show(wv) : 'sin dato'}.` };
  });

  // Premios de la tabla oficial que el Excel no asignó
  for (const line of ['Pegutil', 'Pruven'] as const) {
    if (!report.sellers.some((s) => s.blocks.some((b) => b.line === line))) continue;
    for (const inc of INCENTIVES[line]) {
      if (checks.some((c) => c.award.line === line && c.key === inc.key)) continue;
      const l = leaders(report, line, inc.key);
      const who = l ? (l.top.length > 1 ? `empate entre ${l.top.map((s) => s.display).join(' y ')}` : l.top[0].display) : null;
      checks.push({
        award: { line, criterio: inc.label, ejecutivo: '', pct: null },
        key: inc.key,
        officialPct: inc.pct,
        status: 'missing',
        detail: `El procedimiento establece este incentivo (${fmt(inc.pct, 2)}%) y RESULTADOS no lo asigna.${who ? ` Según los datos corresponde a ${who} (${METRIC[inc.key].show(l!.best)}).` : ''}`,
      });
    }
  }
  return checks;
}

/** El % del Excel difiere del oficial. */
export const pctDiffers = (c: AwardCheck) => c.officialPct != null && c.award.pct != null && Math.abs(c.award.pct - c.officialPct) > 1e-9;

export function awardInsights(checks: AwardCheck[]): Insight[] {
  const out: Insight[] = [];
  const bad = checks.filter((c) => c.status === 'tie' || c.status === 'mismatch');
  if (bad.length)
    out.push({
      sev: 'warn',
      title: `${bad.length} ${bad.length === 1 ? 'reconocimiento requiere' : 'reconocimientos requieren'} revisión antes de pagar variables`,
      body: bad.map((c) => `${titleCase(c.award.criterio)} (${c.award.line}, asignado a ${titleCase(c.award.ejecutivo)}): ${c.detail}`).join(' '),
      tags: ['Variables'],
    });
  const missing = checks.filter((c) => c.status === 'missing');
  const wrongPct = checks.filter(pctDiffers);
  if (missing.length || wrongPct.length) {
    const parts = [
      ...wrongPct.map((c) => `${titleCase(c.award.criterio)} (${c.award.line}): el Excel paga ${fmt(c.award.pct, 2)}% y el procedimiento ${fmt(c.officialPct, 2)}%`),
      ...missing.map((c) => `${c.award.criterio} (${c.award.line}, ${fmt(c.officialPct, 2)}%) no está asignado`),
    ];
    const totals = (['Pegutil', 'Pruven'] as const)
      .map((line) => {
        const excel = checks.filter((c) => c.award.line === line && c.status !== 'missing').reduce((a, c) => a + (c.award.pct ?? 0), 0);
        const official = INCENTIVES[line].reduce((a, x) => a + x.pct, 0);
        return Math.abs(excel - official) > 1e-9 ? `${line}: Excel ${fmt(excel, 2)}%, procedimiento ${fmt(official, 2)}%` : null;
      })
      .filter(Boolean);
    out.push({
      sev: 'warn',
      title: 'La tabla de incentivos del Excel no sigue el procedimiento',
      body: `${parts.join('. ')}.${totals.length ? ` Totales: ${totals.join('; ')}.` : ''}`,
      tags: ['Variables'],
    });
  }
  return out;
}
