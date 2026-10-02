import { fmt, itemKey, signed, STATUS_LABEL, titleCase } from './format';
import type { Insight, Line, MonthReport, Status } from './types';

export interface SellerDelta {
  sheet: string;
  display: string;
  prevTotal: number;
  total: number;
  prevStatus: Status;
  status: Status;
  lines: { line: Line; prev: number; cur: number }[];
  sacos: { prev: number | null; cur: number | null };
  galones: { prev: number | null; cur: number | null };
}

export interface Comparison {
  prevMonth: string;
  team: {
    sacos: { prev: number | null; cur: number | null };
    galones: { prev: number | null; cur: number | null };
    avgScore: { prev: number | null; cur: number | null };
  };
  sellers: Map<string, SellerDelta>;
  /** Valor real del mes anterior por "vendedor|línea|indicador". */
  items: Map<string, { pct: number | null; real: number | null }>;
  insights: Insight[];
}

const norm = (s: string) => s.toUpperCase().replace(/\s+/g, ' ').trim();
const zonaOf = (d: MonthReport, sheet: string) => d.results?.zonas.find((z) => z.sheet === sheet);
const avg = (d: MonthReport) => (d.sellers.length ? d.sellers.reduce((a, s) => a + s.total, 0) / d.sellers.length : null);
const pctChange = (cur: number | null, prev: number | null) => (cur != null && prev ? ((cur - prev) / prev) * 100 : null);

/** Revisa que el par de archivos tenga sentido antes de compararlos. Devuelve un mensaje si hay un problema. */
export function validatePair(cur: MonthReport, prev: MonthReport): string | null {
  if (cur.key && prev.key) {
    if (cur.key === prev.key) return `Los dos archivos son del mismo mes (${titleCase(cur.month ?? '')}). Cargue el cierre anterior en el segundo campo.`;
    if (prev.key > cur.key) return `El archivo "anterior" (${titleCase(prev.month ?? '')}) es más reciente que el del mes (${titleCase(cur.month ?? '')}). Intercámbielos.`;
  }
  return null;
}

export function compare(cur: MonthReport, prev: MonthReport): Comparison {
  const sellers = new Map<string, SellerDelta>();
  const items = new Map<string, { pct: number | null; real: number | null }>();
  const insights: Insight[] = [];
  const prevLabel = titleCase((prev.month ?? 'mes anterior').replace(/\s*20\d\d/, ''));

  for (const ps of prev.sellers)
    for (const b of ps.blocks)
      for (const it of b.items) items.set(`${norm(ps.sheet)}|${b.line}|${itemKey(it.name)}`, { pct: it.pct, real: it.real });

  for (const s of cur.sellers) {
    const p = prev.sellers.find((x) => norm(x.sheet) === norm(s.sheet));
    if (!p) continue;
    const zc = zonaOf(cur, s.sheet), zp = zonaOf(prev, p.sheet);
    sellers.set(s.sheet, {
      sheet: s.sheet,
      display: s.display,
      prevTotal: p.total,
      total: s.total,
      prevStatus: p.status,
      status: s.status,
      lines: s.blocks.map((b) => ({ line: b.line, cur: b.score, prev: p.blocks.find((x) => x.line === b.line)?.score ?? 0 })),
      // Misma fuente que las tarjetas de vendedor: la hoja del vendedor; RESULTADOS solo si la hoja no trae el dato.
      sacos: { prev: p.sacos.real ?? zp?.sacos ?? null, cur: s.sacos.real ?? zc?.sacos ?? null },
      galones: { prev: p.galones.real ?? zp?.galones ?? null, cur: s.galones.real ?? zc?.galones ?? null },
    });
  }

  const team = {
    sacos: { prev: prev.results?.total.sacos ?? null, cur: cur.results?.total.sacos ?? null },
    galones: { prev: prev.results?.total.galones ?? null, cur: cur.results?.total.galones ?? null },
    avgScore: { prev: avg(prev), cur: avg(cur) },
  };

  // ----- hallazgos de tendencia -----
  const dS = pctChange(team.sacos.cur, team.sacos.prev);
  const dG = pctChange(team.galones.cur, team.galones.prev);
  if (dS != null && dG != null) {
    const sev = dS >= 0 && dG >= 0 ? 'good' : dS < 0 && dG < 0 ? 'crit' : 'warn';
    insights.push({
      sev,
      title: `Frente a ${prevLabel}: sacos ${signed(dS)}% · galones ${signed(dG)}%`,
      body: `Sacos: ${fmt(team.sacos.prev)} → ${fmt(team.sacos.cur)}. Galones: ${fmt(team.galones.prev)} → ${fmt(team.galones.cur)}.${sev === 'warn' ? ' Las dos líneas se movieron en direcciones opuestas.' : ''}`,
      tags: ['Tendencia'],
    });
  }
  const deltas = [...sellers.values()];
  const up = deltas.filter((d) => rank(d.status) > rank(d.prevStatus));
  const down = deltas.filter((d) => rank(d.status) < rank(d.prevStatus));
  if (down.length)
    insights.push({ sev: 'crit', title: `${down.map((d) => d.display).join(', ')} ${down.length > 1 ? 'bajaron' : 'bajó'} de estado`, body: down.map((d) => `${d.display}: ${STATUS_LABEL[d.prevStatus]} → ${STATUS_LABEL[d.status]} (${fmt(d.prevTotal, 1)} → ${fmt(d.total, 1)} pts)`).join('. ') + '.', tags: ['Tendencia'] });
  if (up.length)
    insights.push({ sev: 'good', title: `${up.map((d) => d.display).join(', ')} ${up.length > 1 ? 'subieron' : 'subió'} de estado`, body: up.map((d) => `${d.display}: ${STATUS_LABEL[d.prevStatus]} → ${STATUS_LABEL[d.status]} (${fmt(d.prevTotal, 1)} → ${fmt(d.total, 1)} pts)`).join('. ') + '.', tags: ['Tendencia'] });
  const byChange = deltas.slice().sort((a, b) => (a.total - a.prevTotal) - (b.total - b.prevTotal));
  const worst = byChange[0], best = byChange[byChange.length - 1];
  if (worst && worst.total - worst.prevTotal <= -3 && !down.includes(worst))
    insights.push({ sev: 'warn', title: `${worst.display} perdió ${fmt(worst.prevTotal - worst.total, 1)} pts frente a ${prevLabel}`, body: worst.lines.map((l) => `${l.line}: ${fmt(l.prev, 1)} → ${fmt(l.cur, 1)}`).join(' · ') + '. Mantiene el estado, pero la tendencia es negativa.', tags: ['Tendencia'] });
  if (best && best !== worst && best.total - best.prevTotal >= 3 && !up.includes(best))
    insights.push({ sev: 'good', title: `${best.display} ganó ${fmt(best.total - best.prevTotal, 1)} pts frente a ${prevLabel}`, body: best.lines.map((l) => `${l.line}: ${fmt(l.prev, 1)} → ${fmt(l.cur, 1)}`).join(' · ') + '.', tags: ['Tendencia'] });

  // Indicadores que fallan dos meses seguidos en el mismo vendedor. Se excluyen los que falla casi todo
  // el equipo este mes: esos ya aparecen como problema de equipo en el análisis del mes.
  const failRate = new Map<string, number>();
  for (const s of cur.sellers) for (const b of s.blocks) for (const it of b.items) {
    const k = `${b.line}|${itemKey(it.name)}`;
    failRate.set(k, (failRate.get(k) ?? 0) + (it.ok ? 0 : 1 / cur.sellers.length));
  }
  const repeated: string[] = [];
  for (const s of cur.sellers)
    for (const b of s.blocks)
      for (const it of b.items) {
        if (it.ok || (cur.sellers.length >= 3 && (failRate.get(`${b.line}|${itemKey(it.name)}`) ?? 0) >= 0.75)) continue;
        const p = items.get(`${norm(s.sheet)}|${b.line}|${itemKey(it.name)}`);
        if (p && p.pct != null && p.pct < (/COBRANZA/i.test(it.name) ? 90 : 100)) repeated.push(`${s.display} · ${itemKey(it.name)}`);
      }
  if (repeated.length)
    insights.push({ sev: 'warn', title: `${repeated.length} ${repeated.length === 1 ? 'indicador incumplido' : 'indicadores incumplidos'} dos meses seguidos`, body: repeated.slice(0, 6).join('; ') + (repeated.length > 6 ? `; y ${repeated.length - 6} más` : '') + '. Lo que se repite deja de ser un mal mes y pide un plan específico.', tags: ['Tendencia'] });

  return { prevMonth: prev.month ?? 'Mes anterior', team, sellers, items, insights };
}

function rank(s: Status) {
  return s === 'PRODUCTIVO' ? 2 : s === 'ESTABLE' ? 1 : 0;
}

export function prevItem(c: Comparison | null, sheet: string, line: Line, name: string) {
  return c?.items.get(`${norm(sheet)}|${line}|${itemKey(name)}`) ?? null;
}
