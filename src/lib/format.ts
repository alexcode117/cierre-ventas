import type { Status } from './types';

export const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

export function fmt(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString('es-VE', { maximumFractionDigits: digits });
}

export function signed(v: number | null | undefined, digits = 0): string {
  if (v == null || Number.isNaN(v)) return '—';
  return (v > 0 ? '+' : v < 0 ? '−' : '') + fmt(Math.abs(v), digits);
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()).replace(/\bDe\b/g, 'de');
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
