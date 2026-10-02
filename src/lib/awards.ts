import { fmt, titleCase } from './format';
import { findSeller } from './match';
import type { Award, Insight, MonthReport, Seller } from './types';

export type AwardStatus = 'ok' | 'tie' | 'mismatch' | 'unverifiable';
export interface AwardCheck {
  award: Award;
  status: AwardStatus;
  detail: string;
}

export const AWARD_STATUS_LABEL: Record<AwardStatus, string> = {
  ok: 'Coincide',
  tie: 'Empate',
  mismatch: 'No coincide',
  unverifiable: 'No verificable',
};

type Metric = { label: string; value: (s: Seller) => number | null; show: (v: number) => string };

function metricFor(a: Award, cur: MonthReport, prev: MonthReport | null): Metric | 'needs-prev' | null {
  const c = a.criterio.toUpperCase();
  const item = (re: RegExp) => (s: Seller) => s.blocks.find((b) => b.line === a.line)?.items.find((i) => re.test(i.name)) ?? null;
  if (/NUEVOS CLIENTES/.test(c)) {
    const f = item(/NUEVOS CLIENTES/i);
    return { label: 'clientes nuevos', value: (s) => f(s)?.real ?? null, show: (v) => fmt(v) };
  }
  if (/COBRANZA/.test(c)) {
    const f = item(/COBRANZA/i);
    return { label: 'cobranza', value: (s) => f(s)?.real ?? null, show: (v) => `${fmt(v * 100)}%` };
  }
  if (/CARTERA/.test(c)) {
    const f = item(/CARTERA/i);
    return { label: 'atención de cartera', value: (s) => f(s)?.pct ?? null, show: (v) => `${fmt(v)}%` };
  }
  if (/INCREMENTO/.test(c)) {
    if (!prev) return 'needs-prev';
    const key = a.line === 'Pegutil' ? 'sacos' : 'galones';
    const val = (d: MonthReport, s: Seller) => d.results?.zonas.find((z) => z.sheet === s.sheet)?.[key] ?? s[key].real;
    return {
      label: `incremento de ${key} vs mes anterior`,
      value: (s) => {
        const p = prev.sellers.find((x) => x.sheet.toUpperCase() === s.sheet.toUpperCase());
        const before = p ? val(prev, p) : null;
        const now = val(cur, s);
        return before && now != null ? ((now - before) / before) * 100 : null;
      },
      show: (v) => `${v >= 0 ? '+' : ''}${fmt(v, 1)}%`,
    };
  }
  return null;
}

/** Contrasta cada reconocimiento de RESULTADOS con los datos de las hojas de vendedor. */
export function checkAwards(cur: MonthReport, prev: MonthReport | null): AwardCheck[] {
  return cur.awards.map((award) => {
    const m = metricFor(award, cur, prev);
    if (m === 'needs-prev') return { award, status: 'unverifiable', detail: 'Requiere cargar el Excel del mes anterior.' };
    if (!m) return { award, status: 'unverifiable', detail: 'Criterio no reconocido.' };
    const vals = cur.sellers.map((s) => ({ s, v: m.value(s) })).filter((x): x is { s: Seller; v: number } => x.v != null);
    if (!vals.length) return { award, status: 'unverifiable', detail: `No hay datos de ${m.label}.` };
    const best = Math.max(...vals.map((x) => x.v));
    const leaders = vals.filter((x) => Math.abs(x.v - best) < 1e-9).map((x) => x.s);
    const winner = findSeller(cur, award.ejecutivo);
    const names = leaders.map((s) => s.display).join(' y ');
    if (!winner) return { award, status: 'mismatch', detail: `"${titleCase(award.ejecutivo)}" no coincide con ninguna hoja de vendedor. El mejor en ${m.label} es ${names} (${m.show(best)}).` };
    const inLead = leaders.includes(winner);
    if (inLead && leaders.length > 1) return { award, status: 'tie', detail: `Empate en ${m.label}: ${names} con ${m.show(best)}. No hay criterio de desempate.` };
    if (inLead) return { award, status: 'ok', detail: `${winner.display} tiene el mejor resultado en ${m.label} (${m.show(best)}).` };
    const wv = vals.find((x) => x.s === winner)?.v;
    return { award, status: 'mismatch', detail: `El mejor en ${m.label} es ${names} (${m.show(best)}); ${winner.display} tiene ${wv != null ? m.show(wv) : 'sin dato'}.` };
  });
}

export function awardInsights(checks: AwardCheck[]): Insight[] {
  const bad = checks.filter((c) => c.status === 'tie' || c.status === 'mismatch');
  if (!bad.length) return [];
  return [{
    sev: 'warn',
    title: `${bad.length} ${bad.length === 1 ? 'reconocimiento requiere' : 'reconocimientos requieren'} revisión antes de pagar variables`,
    body: bad.map((c) => `${titleCase(c.award.criterio)} (${c.award.line}, asignado a ${titleCase(c.award.ejecutivo)}): ${c.detail}`).join(' '),
    tags: ['Variables'],
  }];
}
