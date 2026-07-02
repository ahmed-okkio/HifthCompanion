'use client';

/**
 * Shared top bar for the non-reader app routes (tracker, sets, …).
 *
 * Mirrors ReaderNav's brand exactly — the same /logo.png mark and Outfit
 * "Hifth Companion" wordmark — so the chrome is identical on every route. The
 * reader's bar additionally carries page-navigation controls; this one keeps
 * the brand + an optional breadcrumb on the left and a free-form actions slot
 * on the right.
 */

import type { ReactNode } from 'react';
import Brand from './Brand';

export default function AppHeader({
  breadcrumb,
  right,
  onOpenNav,
}: {
  /** Optional context label shown after the brand (e.g. a circle name). */
  breadcrumb?: string;
  /** Right-aligned actions (language switcher, nav links, …). */
  right?: ReactNode;
  /** When set, renders a mobile-only hamburger that opens the nav drawer. */
  onOpenNav?: () => void;
}) {
  return (
    <header
      className="sticky top-0 z-50 w-full border-b"
      style={{
        background: 'var(--surface-main)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-e1)',
      }}
    >
      <div
        className="flex items-center justify-between gap-4 w-full"
        style={{ height: 72, padding: '0 var(--space-16)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {onOpenNav && (
            <button
              type="button"
              onClick={onOpenNav}
              aria-label="Open navigation"
              className="lg:hidden flex items-center justify-center shrink-0"
              style={{ width: 40, height: 40, marginInlineStart: -8, borderRadius: 'var(--radius-sm-px)', border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          <Brand />

          {breadcrumb && (
            <span className="flex items-center gap-2 min-w-0">
              <span aria-hidden style={{ color: 'var(--text-muted)' }} className="rtl:-scale-x-100">
                ›
              </span>
              <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>
                {breadcrumb}
              </span>
            </span>
          )}
        </div>

        {right && <div className="flex items-center gap-3 shrink-0">{right}</div>}
      </div>
    </header>
  );
}
