'use client';
import type { ReactNode } from 'react';

/**
 * Shared chrome for the reader's right context-panel cards (Sets / Notes /
 * Share): white surface, radius-lg, neutral border, e1 shadow, and a uniform
 * icon-chip header so the panel reads as one designed system.
 */
export default function PanelCard({
  testid,
  icon,
  title,
  trailing,
  children,
}: {
  testid: string;
  icon: ReactNode;
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      data-testid={testid}
      className="bg-surface-main rounded-lg border border-neutral-200 shadow-e1 overflow-hidden"
    >
      <div
        className="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-200"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            aria-hidden
            className="flex items-center justify-center shrink-0 size-6 rounded-sm bg-accent-muted text-green-600"
          >
            {icon}
          </span>
          <h2 className="font-semibold truncate text-small text-primary">
            {title}
          </h2>
        </div>
        <div className="flex items-center gap-2 shrink-0">{trailing}</div>
      </div>
      {children}
    </section>
  );
}

/** 14px stroke icons for the panel headers. */
export function PanelIcon({ d }: { d: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export const ICON_PATHS = {
  layers: 'm12 2 9 4.9-9 4.9-9-4.9L12 2zm-9 9.8 9 4.9 9-4.9M3 16.7l9 4.9 9-4.9',
  note: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z',
  share: 'M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v13',
} as const;
