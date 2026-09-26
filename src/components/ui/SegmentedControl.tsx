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
      // inset ring instead of a border: with a real border, overflow:hidden
      // clips children to the OUTER radius and the active segment's fill bleeds
      // past the rounded corner. An inset shadow has no box offset, so the
      // fill clips cleanly to the frame.
      className="grid bg-surface-main inset-ring inset-ring-default rounded-md overflow-hidden"
      style={{
        // minmax(0,1fr) not 1fr: a bare 1fr keeps each cell at least its label's
        // min-content width, so a long label (e.g. "What I've memorized") widens
        // its column and overflows the frame's inline-end. minmax(0,…) lets cells
        // stay equal within the frame; long labels wrap instead of pushing out.
        // eslint-disable-next-line shadcn/no-inline-styles -- column count from options
        gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
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
            className={`min-h-11 px-3 py-1.5 cursor-pointer text-body font-semibold leading-tight transition-colors duration-(--duration-fast) ease-out ${i > 0 ? 'border-s border-solid border-s-default' : ''} ${on ? 'bg-accent text-accent-contrast' : 'bg-transparent text-secondary'}`}
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
