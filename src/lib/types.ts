export type Status = 'PRODUCTIVO' | 'ESTABLE' | 'CRITICO';
export type Line = 'Pegutil' | 'Pruven';

export interface Item {
  name: string;
  obj: number | null;
  real: number | null;
  pct: number | null;
  ok: boolean;
  pts: number;
}

export interface Block {
  line: Line;
  title: string | null;
  items: Item[];
  /** Puntaje que muestra la hoja (o la suma, si no hay total). */
  score: number;
  /** Suma de las valoraciones individuales. */
  sum: number;
  stated: number | null;
  /** Estado escrito en el título del bloque, p. ej. "(ESTABLE)". */
  declared: Status | null;
  status: Status;
}

export interface Seller {
  sheet: string;
  display: string;
  title: string | null;
  zona: string | null;
  blocks: Block[];
  sacos: { meta: number | null; real: number | null };
  galones: { meta: number | null; real: number | null };
  total: number;
  status: Status;
}

export interface Zona {
  zona: string;
  vendedor: string;
  sacos: number | null;
  galones: number | null;
  sheet: string | null;
}

export interface Results {
  zonas: Zona[];
  total: { sacos: number | null; galones: number | null };
  meta: { sacos: number | null; galones: number | null };
}

export interface Award {
  line: Line;
  criterio: string;
  ejecutivo: string;
  pct: number | null;
}

export interface Metas {
  title: string;
  cols: string[];
  rows: { vendedor: string; values: (number | null)[] }[];
}

export type AlertLevel = 'crit' | 'warn' | 'info';
export interface DataAlert {
  level: AlertLevel;
  text: string;
}

export interface MonthReport {
  month: string | null;
  /** "2026-08" */
  key: string | null;
  sellers: Seller[];
  results: Results | null;
  awards: Award[];
  metas: Metas | null;
  alerts: DataAlert[];
}

export type Severity = 'crit' | 'warn' | 'good' | 'info';
export interface Insight {
  sev: Severity;
  title: string;
  body: string;
  tags: string[];
}
