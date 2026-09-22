'use client';

import type { ReactNode } from 'react';

/** Wide segmented control: equal segments in a rounded frame, divided by thin
 *  separators. The active segment fills with the accent (fades, no slide).
 *  Used for status pickers and mode toggles. RTL-safe. */
export function SegmentedControl({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string; icon?: ReactNode }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const n = options.length;
  return (
    <div
      style={{
        display: 'grid',
        // minmax(0,1fr) not 1fr: a bare 1fr keeps each cell at least its label's
        // min-content width, so a long label (e.g. "What I've memorized") widens
        // its column and overflows the frame's inline-end. minmax(0,…) lets cells
        // stay equal within the frame; long labels wrap instead of pushing out.
        gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
        background: 'var(--bg-input)',
        // inset ring instead of a border: with a real border, overflow:hidden
        // clips children to the OUTER radius and the active segment's fill bleeds
        // past the rounded corner. An inset shadow has no box offset, so the
        // fill clips cleanly to the frame.
        boxShadow: 'inset 0 0 0 1px var(--border-default)',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
      }}
    >
      {options.map((o, i) => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            aria-pressed={on}
            style={{
              minHeight: 44,
              padding: '6px 12px',
              border: 'none',
              borderInlineStart: i > 0 ? '1px solid var(--border-default)' : 'none',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 600,
              lineHeight: 1.2,
              background: on ? 'var(--accent)' : 'transparent',
              color: on ? 'var(--accent-contrast)' : 'var(--text-secondary)',
              transition: 'background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out)',
            }}
          >
            <span className="flex items-center justify-center gap-2">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
