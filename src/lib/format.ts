import type { Status } from './types';

export const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

export function fmt(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString('es-VE', { maximumFractionDigits: digits });
}

/** "1 pt", "3 pts", "0,5 pts" */
export const ptsLabel = (n: number | null | undefined) => (n === 1 ? '1 pt' : `${fmt(n, 1)} pts`);

export function signed(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '—';
  return (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), digits);
}

// Conectores que se dejan en minúscula dentro de un título ("Cobranza a tiempo", "Manejo de cartera").
const SMALL_WORDS = /\s(A|De|Del|La|Las|Los|En|Y|Por|Con)(?=\s|$)/g;
export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()).replace(SMALL_WORDS, (m) => m.toLowerCase());
}

export function monthKey(month: string | null): string | null {
  if (!month) return null;
  const u = month.toUpperCase().replace('SETIEMBRE', 'SEPTIEMBRE');
  const i = MESES.findIndex((m) => u.includes(m));
  const y = u.match(/20\d\d/)?.[0];
  return i >= 0 && y ? `${y}-${String(i + 1).padStart(2, '0')}` : null;
}

export { statusOf } from './rules';

export const STATUS_LABEL: Record<Status, string> = { PRODUCTIVO: 'Productivo', ESTABLE: 'Estable', CRITICO: 'Crítico' };

export type Band = 'good' | 'warn' | 'crit' | 'none';
export function band(pct: number | null | undefined): Band {
  if (pct == null) return 'none';
  return pct >= 100 ? 'good' : pct >= 80 ? 'warn' : 'crit';
}

/** Color de un indicador: en el procedimiento sigue los tramos de puntos (3 verde, 1 ámbar, 0 rojo); si no, el % logrado. */
export function itemBand(item: { kpi?: string; pts: number; pct: number | null }, pts = item.pts, pct = item.pct): Band {
  if (item.kpi && item.kpi !== 'PROD') return pts >= 3 ? 'good' : pts > 0 ? 'warn' : 'crit';
  return band(pct);
}

/** "VENTAS CAUCHOS - PASTA " → "Ventas Cauchos" */
export function prettyItem(name: string): string {
  return titleCase(
    name
      .replace(/\s*\(70%\)/, '')
      .replace(/\s+-\s*PASTA/i, '')
      .replace(/META\s+/i, '')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

/** Nombre del indicador sin el sufijo de la línea, para agrupar entre líneas. */
export function itemKey(name: string): string {
  return prettyItem(name).replace(/ (Pegutil|Pruven)$/i, '');
}
