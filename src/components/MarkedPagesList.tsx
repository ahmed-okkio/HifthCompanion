'use client';
import React from 'react';
import { useI18n } from '@/components/I18nProvider';
import {
  badgeLevel, groupBySurah, isNeedsFocus, maxCount, sortMarked,
  type MarkColors, type MarkedPage,
} from '@/lib/markedPages';
import { getSurahForPage, getSurahName } from '@/lib/quran';
import { PRESET_COLORS } from '@/lib/canvasTools';
import type { MessageKey } from '@/lib/i18n/dictionaries';

// PRD 0009 D8/L2: badge fill by mark count. Grey reuses the neutral chip; orange/red use tokens.
export const BADGE_COLORS: Record<'grey' | 'orange' | 'red', { bg: string; fg: string }> = {
  grey: { bg: 'var(--neutral-100)', fg: 'var(--text-muted)' },
  orange: { bg: 'var(--warning)', fg: 'var(--accent-contrast)' },
  red: { bg: 'var(--danger-500)', fg: 'var(--accent-contrast)' },
};

// Hex → preset name, for the chips' text alternative. The picker also allows a custom hex,
// which has no name — those chips fall back to the hex itself.
const PRESET_NAMES: Record<string, string> = Object.fromEntries(
  PRESET_COLORS.map(c => [c.value.toLowerCase(), c.name]),
);

/**
 * Per-colour mark counts for one page: a dot and a number per colour, heaviest first.
 * Colour alone carries no meaning to a colour-blind reader, so each chip also names its
 * colour in an aria-label. Renders nothing for a row saved before mark_colors existed.
 */
function ColorChips({ colors }: { colors?: MarkColors }) {
  const { t, fmtNum } = useI18n();
  const entries = React.useMemo(
    () => Object.entries(colors ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
    [colors],
  );
  if (entries.length === 0) return null;
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
      {entries.map(([hex, n]) => {
        const name = PRESET_NAMES[hex.toLowerCase()];
        return (
          <span
            key={hex}
            aria-label={t('reader.markCountColor', { n, color: name ? t(`color.${name}` as MessageKey) : hex })}
            className="inline-flex shrink-0 items-center gap-1 tabular-nums"
            style={{
              padding: '1px 7px 1px 5px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--neutral-100)',
              fontSize: 'var(--type-meta-size)',
              fontWeight: 700,
              color: 'var(--text-secondary)',
            }}
          >
            <span
              aria-hidden
              className="shrink-0"
              style={{ width: '8px', height: '8px', borderRadius: 'var(--radius-full)', background: hex }}
            />
            {fmtNum(n)}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Presentational marked-pages list shared by the reader's Annotations tab and the
 * tracker student-detail page (C1). Rows show page + colour chips + count badge (L2)
 * with a Needs Focus pill on max-count rows (L3), ordered per L4. Pass `onJump` to make
 * rows jump links (reader); omit it for a static read-only list (tracker, C2).
 * Empty input renders the "No marked pages yet" state (R6/C3).
 *
 * `grouped` folds the rows into collapsible surah cards in mushaf order — the panel's
 * other sort. It replaces L4's count-desc ranking (you can group or rank, not both), so
 * the collapsed card carries a Needs Focus dot to keep that signal visible.
 */
export default function MarkedPagesList({
  rows, onJump, hrefFor, limit, grouped = false, currentPage,
}: {
  rows: MarkedPage[];
  onJump?: (page: number) => void;
  /** Render each row as a link to this href (tracker: jump into the mushaf at that page). */
  hrefFor?: (page: number) => string;
  /** Cap the list to the top-N rows after sorting (tracker shows top 3). Flat list only. */
  limit?: number;
  /** Group rows into collapsible surah cards, mushaf order. */
  grouped?: boolean;
  /** Opens that page's surah card on first render, so the panel starts where the reader is. */
  currentPage?: number;
}) {
  const { t, locale, fmtNum } = useI18n();
  // max is over the FULL set so the Needs Focus tag stays correct even when the list is capped.
  const full = React.useMemo(() => sortMarked(rows), [rows]);
  const max = React.useMemo(() => maxCount(full), [full]);
  const sorted = React.useMemo(() => (limit ? full.slice(0, limit) : full), [full, limit]);
  const groups = React.useMemo(() => (grouped ? groupBySurah(rows) : []), [grouped, rows]);

  // Which surah cards are open. Seeded once from the open page; after that it's the
  // reader's own choice, and navigating the mushaf doesn't reshuffle it underneath them.
  const [openSurahs, setOpenSurahs] = React.useState<Set<number>>(
    () => new Set(currentPage ? [getSurahForPage(currentPage)] : []),
  );
  const toggleSurah = (surah: number) =>
    setOpenSurahs(prev => {
      const next = new Set(prev);
      if (!next.delete(surah)) next.add(surah);
      return next;
    });

  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-center" style={{ color: 'var(--text-muted)', fontSize: 'var(--type-small-size)' }}>
        {t('reader.noMarkedPages')}
      </p>
    );
  }

  const pageRow = (row: MarkedPage, indent: boolean) => {
    const badge = BADGE_COLORS[badgeLevel(row.count)];
    const focus = isNeedsFocus(row.count, max);
    const inner = (
      <>
        <span
          className="shrink-0 truncate"
          style={{ fontSize: 'var(--type-body-size)', fontWeight: 500, color: 'var(--text-primary)' }}
        >
          {t('reader.pageNum', { n: row.page })}
        </span>
        <ColorChips colors={row.colors} />
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
            marginInlineStart: 'auto',
            height: '28px',
            minWidth: '28px',
            padding: '0 8px',
            borderRadius: 'var(--radius-full)',
            fontSize: 'var(--type-meta-size)',
            fontWeight: 700,
            background: badge.bg,
            color: badge.fg,
          }}
        >
          {fmtNum(row.count)}
        </span>
      </>
    );
    // Grouped rows sit inside a card, so they run shorter and indent past the caret.
    const box = {
      minHeight: indent ? '44px' : '56px',
      paddingBlock: indent ? '8px' : '12px',
      paddingInlineStart: indent ? '30px' : undefined,
      background: 'transparent',
    } as React.CSSProperties;
    const cls = `flex w-full items-center gap-2 px-4 text-start transition-colors duration-150`;
    return (
      <li key={row.page}>
        {hrefFor ? (
          <a
            href={hrefFor(row.page)}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--neutral-50)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            className={cls}
            style={box}
          >
            {inner}
          </a>
        ) : onJump ? (
          <button
            type="button"
            onClick={() => onJump(row.page)}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--neutral-50)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            className={cls}
            style={box}
          >
            {inner}
          </button>
        ) : (
          // C2: read-only surface — static row, no jump/hover affordance.
          <div className={`flex w-full items-center gap-2 px-4`} style={box}>
            {inner}
          </div>
        )}
      </li>
    );
  };

  if (!grouped) return <ul>{sorted.map(row => pageRow(row, false))}</ul>;

  return (
    <div className="flex flex-col gap-1.5 p-2">
      {groups.map(group => {
        const open = openSurahs.has(group.surah);
        return (
          <details
            key={group.surah}
            open={open}
            className="overflow-hidden"
            style={{
              border: '1px solid var(--border-subtle)',
              borderColor: open ? 'var(--border-accent)' : 'var(--border-subtle)',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-main)',
            }}
          >
            <summary
              // The open state is React's, so the browser's own toggle has to stand down.
              onClick={e => { e.preventDefault(); toggleSurah(group.surah); }}
              className="marked-summary flex cursor-pointer items-center gap-2 px-3 transition-colors duration-150"
              style={{ minHeight: '48px', paddingBlock: '8px' }}
            >
              <svg
                aria-hidden
                className="shrink-0 transition-transform duration-200"
                style={{
                  width: '14px',
                  height: '14px',
                  color: open ? 'var(--text-accent)' : 'var(--text-muted)',
                  transform: open ? 'rotate(90deg)' : undefined,
                }}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
              >
                <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="flex min-w-0 flex-col">
                <span className="truncate" style={{ fontSize: 'var(--type-small-size)', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {getSurahName(group.surah, locale)}
                </span>
                <span className="tabular-nums" style={{ fontSize: 'var(--type-meta-size)', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {t('reader.pagesCount', { n: group.pages.length })} · {t('reader.markCount', { n: group.count })}
                </span>
              </span>
              {/* A collapsed card hides its Needs Focus pill — the dot keeps the L3 signal up here. */}
              {group.hasFocus && (
                <span
                  className="shrink-0"
                  title={t('reader.surahNeedsFocus')}
                  aria-label={t('reader.surahNeedsFocus')}
                  style={{
                    marginInlineStart: 'auto',
                    width: '8px',
                    height: '8px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--danger-500)',
                  }}
                />
              )}
            </summary>
            <ul style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
              {group.pages.map(row => pageRow(row, true))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
