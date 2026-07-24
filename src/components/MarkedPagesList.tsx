'use client';
import React from 'react';
import { useI18n } from '@/components/I18nProvider';
import { badgeLevel, isNeedsFocus, maxCount, sortMarked, type MarkedPage } from '@/lib/markedPages';

// PRD 0009 D8/L2: badge fill by mark count. Grey reuses the neutral chip; orange/red use tokens.
export const BADGE_COLORS: Record<'grey' | 'orange' | 'red', { bg: string; fg: string }> = {
  grey: { bg: 'var(--neutral-100)', fg: 'var(--text-muted)' },
  orange: { bg: 'var(--warning)', fg: 'var(--accent-contrast)' },
  red: { bg: 'var(--danger-500)', fg: 'var(--accent-contrast)' },
};

/**
 * Presentational marked-pages list shared by the reader's Marked tab and the
 * tracker student-detail page (C1). Rows show page + count badge (L2) with a
 * Needs Focus pill on max-count rows (L3), ordered per L4. Pass `onJump` to make
 * rows jump links (reader); omit it for a static read-only list (tracker, C2).
 * Empty input renders the "No marked pages yet" state (R6/C3).
 */
export default function MarkedPagesList({
  rows, onJump, hrefFor, limit,
}: {
  rows: MarkedPage[];
  onJump?: (page: number) => void;
  /** Render each row as a link to this href (tracker: jump into the mushaf at that page). */
  hrefFor?: (page: number) => string;
  /** Cap the list to the top-N rows after sorting (tracker shows top 3). */
  limit?: number;
}) {
  const { t, fmtNum } = useI18n();
  // max is over the FULL set so the Needs Focus tag stays correct even when the list is capped.
  const full = React.useMemo(() => sortMarked(rows), [rows]);
  const max = React.useMemo(() => maxCount(full), [full]);
  const sorted = React.useMemo(() => (limit ? full.slice(0, limit) : full), [full, limit]);

  if (sorted.length === 0) {
    return (
      <p className="px-4 py-6 text-center" style={{ color: 'var(--text-muted)', fontSize: 'var(--type-small-size)' }}>
        {t('reader.noMarkedPages')}
      </p>
    );
  }

  return (
    <ul>
      {sorted.map(row => {
        const colors = BADGE_COLORS[badgeLevel(row.count)];
        const focus = isNeedsFocus(row.count, max);
        const inner = (
          <>
            <span
              className="min-w-0 flex-1 truncate"
              style={{ fontSize: 'var(--type-body-size)', fontWeight: 500, color: 'var(--text-primary)' }}
            >
              {t('reader.pageNum', { n: row.page })}
            </span>
            {focus && (
              <span
                className="shrink-0"
                style={{
                  padding: '2px 8px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: 'var(--type-meta-size)',
                  fontWeight: 700,
                  background: 'var(--danger-muted)',
                  color: 'var(--danger)',
                }}
              >
                {t('reader.needsFocus')}
              </span>
            )}
            <span
              className="shrink-0 inline-flex items-center justify-center tabular-nums"
              aria-label={t('reader.markCount', { n: row.count })}
              style={{
                height: '28px',
                minWidth: '28px',
                padding: '0 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--type-meta-size)',
                fontWeight: 700,
                background: colors.bg,
                color: colors.fg,
              }}
            >
              {fmtNum(row.count)}
            </span>
          </>
        );
        return (
          <li key={row.page}>
            {hrefFor ? (
              <a
                href={hrefFor(row.page)}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'var(--neutral-50)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; }}
                className="flex w-full items-center gap-3 px-4 text-start transition-colors duration-150"
                style={{ minHeight: '56px', paddingBlock: '12px', background: 'transparent' }}
              >
                {inner}
              </a>
            ) : onJump ? (
              <button
                type="button"
                onClick={() => onJump(row.page)}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-50)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                className="flex w-full items-center gap-3 px-4 text-start transition-colors duration-150"
                style={{ minHeight: '56px', paddingBlock: '12px', background: 'transparent' }}
              >
                {inner}
              </button>
            ) : (
              // C2: read-only surface — static row, no jump/hover affordance.
              <div className="flex w-full items-center gap-3 px-4" style={{ minHeight: '56px', paddingBlock: '12px' }}>
                {inner}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
