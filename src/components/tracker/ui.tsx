'use client';

/**
 * Shared presentational primitives for the tracker module. Logic-free — these
 * exist purely to give the tracker pages the same calm, card-driven hierarchy
 * as the reader (design tokens only, no bare hex/px palette values).
 */

import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { HomeworkStatus } from '@/lib/homework';

/** Badge palette per homework status — open/completed/missed at a glance. */
export const HOMEWORK_STATUS_STYLE: Record<HomeworkStatus, CSSProperties> = {
  open: { background: 'var(--accent-muted)', color: 'var(--text-accent)' },
  completed: { background: 'rgba(16,185,129,0.12)', color: 'var(--success)' },
  missed: { background: 'var(--danger-muted)', color: 'var(--danger)' },
};

/** Page hero: large title + optional subtitle, the same altitude the reader
 *  uses for section intros. */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1
          className="font-bold tracking-tight"
          style={{ color: 'var(--text-primary)', fontSize: 'var(--type-heading-l-size)' }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Uppercase section label, optionally trailed by a count pill or other node. */
export function SectionTitle({
  children,
  trailing,
}: {
  children: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2">
      <h2
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: 'var(--text-muted)' }}
      >
        {children}
      </h2>
      {trailing}
    </div>
  );
}

/** Dashed, centered placeholder shown when a list is empty. */
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center gap-1"
      style={{
        padding: '28px 20px',
        border: '1px dashed var(--border-default)',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--text-muted)',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

/** Deterministic initial/colour avatar derived from an id or name. Gives the
 *  roster real visual identity without inventing profile data. */
export function Avatar({ seed, size = 36 }: { seed: string; size?: number }) {
  const hues = [160, 200, 260, 320, 20, 95];
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = hues[h % hues.length];
  const initial = (seed.trim()[0] ?? '?').toUpperCase();
  return (
    <span
      aria-hidden
      className="flex items-center justify-center font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        borderRadius: 'var(--radius-full)',
        fontSize: size * 0.4,
        color: `hsl(${hue} 55% 32%)`,
        background: `hsl(${hue} 70% 92%)`,
      }}
    >
      {initial}
    </span>
  );
}

/** KPI tile: icon chip + big value over a small label. */
export function StatCard({
  value,
  label,
  icon,
}: {
  value: ReactNode;
  label: string;
  icon?: ReactNode;
}) {
  return (
    <div className="card flex items-center gap-3" style={{ padding: '14px 16px' }}>
      {icon && (
        <span
          aria-hidden
          className="flex items-center justify-center shrink-0"
          style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            background: 'var(--accent-muted)',
            fontSize: 18,
          }}
        >
          {icon}
        </span>
      )}
      <div className="flex flex-col min-w-0">
        <span
          className="font-bold leading-tight truncate"
          style={{ color: 'var(--text-primary)', fontSize: 22 }}
        >
          {value}
        </span>
        <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
          {label}
        </span>
      </div>
    </div>
  );
}

/** Calendar-style date block for agenda rows: weekday over day-of-month. */
export function DateChip({ iso, locale }: { iso: string; locale: string }) {
  const d = new Date(iso);
  return (
    <span
      aria-hidden
      className="flex flex-col items-center justify-center shrink-0"
      style={{
        width: 46,
        height: 46,
        borderRadius: 'var(--radius-md)',
        background: 'var(--accent-muted)',
        color: 'var(--text-accent)',
      }}
    >
      <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', lineHeight: 1.4 }}>
        {d.toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' })}
      </span>
      <span style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.1 }}>{d.getUTCDate()}</span>
    </span>
  );
}

/** Labeled −/+ stepper for bounded numbers (page ranges). Replaces bare
 *  type="number" inputs whose native spinners look nothing like the app. */
export function NumberStepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, Number.isNaN(v) ? min : v));
  // Draft mirrors the field while typing so intermediate states ("", "6" on the
  // way to "60") aren't clamped mid-keystroke; commit on blur.
  const [draft, setDraft] = useState<string | null>(null);
  const step = (delta: number) => {
    setDraft(null);
    onChange(clamp(value + delta));
  };
  const btn: CSSProperties = {
    width: 34,
    alignSelf: 'stretch',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-muted)',
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all var(--duration-fast) var(--ease-out)',
  };
  return (
    <label className="flex flex-col gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
      {label}
      <span
        className="flex items-center"
        style={{
          height: 40,
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-sm)',
          background: 'var(--bg-input)',
          overflow: 'hidden',
        }}
      >
        <button type="button" aria-label="−" tabIndex={-1} style={btn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => step(-1)}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          value={draft ?? value}
          min={min}
          max={max}
          onChange={(e) => {
            setDraft(e.target.value);
            const n = Number(e.target.value);
            if (e.target.value !== '' && n >= min && n <= max) onChange(n);
          }}
          onBlur={() => {
            onChange(clamp(Number(draft ?? value)));
            setDraft(null);
          }}
          onFocus={(e) => e.target.select()}
          style={{
            width: 46,
            textAlign: 'center',
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-primary)',
          }}
        />
        <button type="button" aria-label="+" tabIndex={-1} style={btn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => step(1)}>
          +
        </button>
      </span>
    </label>
  );
}

/** Small status dot (active/pending/…). */
export function StatusDot({ color }: { color: string }) {
  return (
    <span
      aria-hidden
      className="shrink-0"
      style={{ width: 8, height: 8, borderRadius: 'var(--radius-full)', background: color }}
    />
  );
}

/** Right-pointing chevron used to mark a row as navigable. Flips under RTL. */
export function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="shrink-0 rtl:-scale-x-100"
      style={{ color: 'var(--text-muted)' }}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Tab bar for switching between views. Minimal — just a row of buttons. */
export function TabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: { key: string; label: string }[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex gap-0" role="tablist" style={{ borderBottom: '2px solid var(--border-subtle)' }}>
      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={isActive}
            onClick={() => onSelect(t.key)}
            className="btn btn-ghost"
            style={{
              minHeight: 42,
              fontSize: 14,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--text-accent)' : 'var(--text-muted)',
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -2,
              borderRadius: 0,
              padding: '8px 20px',
            }}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Short, friendly label for a member that has no profile name yet. */
export function shortId(id: string) {
  return id.slice(0, 6);
}
