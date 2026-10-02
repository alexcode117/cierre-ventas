'use client';

import clsx from 'clsx';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { band, fmt, STATUS_LABEL } from '@/lib/format';
import type { Status } from '@/lib/types';

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('min-w-0 rounded-xl border border-line bg-panel', className)}>{children}</div>;
}

export function Button({ variant = 'ghost', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' }) {
  return (
    <button
      {...p}
      className={clsx(
        'inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13.5px] font-semibold whitespace-nowrap transition-colors disabled:cursor-default disabled:opacity-50',
        variant === 'primary' ? 'bg-accent text-on-accent hover:brightness-110' : 'border border-line bg-panel text-ink hover:border-ink-3',
        className,
      )}
    />
  );
}

const STATUS_CLS: Record<Status, string> = {
  PRODUCTIVO: 'bg-good-bg text-good-ink',
  ESTABLE: 'bg-warn-bg text-warn-ink',
  CRITICO: 'bg-crit-bg text-crit-ink',
};
const RISK_CLS = { bajo: STATUS_CLS.PRODUCTIVO, medio: STATUS_CLS.ESTABLE, alto: STATUS_CLS.CRITICO };

export function Pill({ className, children }: { className: string; children: ReactNode }) {
  return (
    <span className={clsx('inline-flex items-center gap-1.5 rounded-full py-0.5 pr-2 pl-1.5 font-mono text-[11px] font-medium tracking-wide whitespace-nowrap', className)}>
      <span className="size-[7px] rounded-full bg-current" aria-hidden />
      {children}
    </span>
  );
}
export const StatusPill = ({ s, children }: { s: Status; children?: ReactNode }) => <Pill className={STATUS_CLS[s]}>{children ?? STATUS_LABEL[s]}</Pill>;
export const RiskPill = ({ r }: { r: 'alto' | 'medio' | 'bajo' }) => <Pill className={RISK_CLS[r]}>{r}</Pill>;

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="relative inline-flex flex-wrap gap-0.5 rounded-lg bg-line-2 p-[3px]">
      {options.map(([k, l]) => (
        <button key={k} aria-pressed={value === k} onClick={() => onChange(k)} className={clsx('relative rounded-md px-3 py-1 text-[12.5px] font-semibold transition-colors', value === k ? 'text-ink' : 'text-ink-2 hover:text-ink')}>
          {value === k && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-md bg-panel shadow-sm" transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }} />}
          <span className="relative">{l}</span>
        </button>
      ))}
    </div>
  );
}

/** Número que cuenta desde cero al aparecer. */
export function CountUp({ value, digits = 0, className }: { value: number | null; digits?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || value == null) return;
    if (reduce) { el.textContent = fmt(value, digits); return; }
    const c = animate(0, value, { duration: 0.9, ease: [0.16, 1, 0.3, 1], onUpdate: (v) => (el.textContent = fmt(v, digits)) });
    return () => c.stop();
  }, [value, digits, reduce]);
  return <span ref={ref} className={className}>{fmt(value, digits)}</span>;
}

/** Barra de avance contra la meta (100% marcado con una línea). */
export function Meter({ pct, max = 150 }: { pct: number | null; max?: number }) {
  if (pct == null) return null;
  const b = band(pct);
  const color = b === 'good' ? 'var(--good)' : b === 'warn' ? 'var(--warn)' : 'var(--crit)';
  return (
    <div className="relative h-2 rounded bg-track" role="img" aria-label={`${fmt(pct, 1)}% de la meta`}>
      <motion.i className="absolute inset-y-0 left-0 rounded" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${(Math.min(pct, max) / max) * 100}%` }} transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} />
      <span className="absolute -top-1 -bottom-1 w-0.5 rounded bg-ink" style={{ left: `${(100 / max) * 100}%` }} />
    </div>
  );
}

export function Delta({ cur, prev, suffix = '', digits = 0, pct = false, label }: { cur: number | null | undefined; prev: number | null | undefined; suffix?: string; digits?: number; pct?: boolean; label?: string }) {
  if (cur == null || prev == null) return null;
  const d = pct ? (prev ? ((cur - prev) / prev) * 100 : null) : cur - prev;
  if (d == null) return null;
  return (
    <span className={clsx('font-mono text-xs font-medium', d >= 0 ? 'text-good-ink' : 'text-crit-ink')}>
      {d >= 0 ? '▲' : '▼'} {fmt(Math.abs(d), digits)}{pct ? '%' : suffix}{label ? ` ${label}` : ''}
    </span>
  );
}

export function SectionHead({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        <h2 className="display text-xl font-bold" style={{ fontStretch: '85%' }}>{title}</h2>
        {sub && <p className="text-[13.5px] text-ink-2">{sub}</p>}
      </div>
      {children}
    </div>
  );
}

export const fadeUp = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const } },
};
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
