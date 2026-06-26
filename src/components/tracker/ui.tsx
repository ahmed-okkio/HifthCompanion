'use client';

/**
 * Shared presentational primitives for the tracker module. Logic-free — these
 * exist purely to give the tracker pages the same calm, card-driven hierarchy
 * as the reader (design tokens only, no bare hex/px palette values).
 */

import type { ReactNode } from 'react';

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

/** Short, friendly label for a member that has no profile name yet. */
export function shortId(id: string) {
  return id.slice(0, 6);
}
