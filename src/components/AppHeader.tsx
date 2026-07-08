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
import Link from 'next/link';
import Brand from './Brand';
import { useI18n } from './I18nProvider';

export type Crumb = { label: string; href?: string };

export default function AppHeader({
  breadcrumb,
  right,
  onOpenNav,
}: {
  /** Context after the brand: a single label, or a crumb path ("Circles › Test").
   *  Crumbs with an href render as links. */
  breadcrumb?: string | Crumb[];
  /** Right-aligned actions (language switcher, nav links, …). */
  right?: ReactNode;
  /** When set, renders a mobile-only hamburger that opens the nav drawer. */
  onOpenNav?: () => void;
}) {
  const { t } = useI18n();
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
              aria-label={t('nav.openNavigation')}
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
          {/* Brand lives in the mobile drawer instead; header shows it only ≥lg. */}
          <span className="hidden lg:flex min-w-0"><Brand /></span>

          {breadcrumb && (() => {
            const crumbs: Crumb[] = typeof breadcrumb === 'string' ? [{ label: breadcrumb }] : breadcrumb;
            const sep = (
              <svg aria-hidden width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
                   style={{ color: 'var(--text-muted)' }} className="shrink-0 rtl:-scale-x-100">
                <path d="m9 18 6-6-6-6" />
              </svg>
            );
            return (
              // Extra left margin = the SPACE between the brand and the path.
              <span className="flex items-center gap-2 min-w-0" style={{ marginInlineStart: 'var(--space-8)' }}>
                {crumbs.map((c, i) => {
                  const last = i === crumbs.length - 1;
                  return (
                    <span key={i} className="flex items-center gap-2 min-w-0">
                      {c.href && !last ? (
                        <Link href={c.href} className="text-sm font-semibold truncate" style={{ color: 'var(--text-muted)' }}>{c.label}</Link>
                      ) : (
                        <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-secondary)' }}>{c.label}</span>
                      )}
                      {!last && sep}
                    </span>
                  );
                })}
              </span>
            );
          })()}
        </div>

        {right && <div className="flex items-center gap-3 shrink-0">{right}</div>}
      </div>
    </header>
  );
}
