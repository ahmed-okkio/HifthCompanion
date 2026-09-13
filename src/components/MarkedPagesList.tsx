'use client';
import React from 'react';
import { useI18n } from '@/components/I18nProvider';
import {
  badgeLevel, groupBySurah,
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
  // One line while they fit, wrapping to a second rather than shrinking or clipping.
  return (
    <span className="flex min-w-0 flex-1 flex-wrap items-center" style={{ gap: '4px' }}>
      {entries.map(([hex, n]) => {
        const name = PRESET_NAMES[hex.toLowerCase()];
        return (
          <span
            key={hex}
            aria-label={t('reader.markCountColor', { n, color: name ? t(`color.${name}` as MessageKey) : hex })}
            className="inline-flex shrink-0 items-center tabular-nums"
            style={{
              gap: '3px',
              padding: '1px 6px 1px 4px',
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
              style={{ width: '7px', height: '7px', borderRadius: 'var(--radius-full)', background: hex }}
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
 * tracker student-detail page (C1). Pages fold into collapsible surah cards in mushaf
 * order; each row shows page + colour chips + count badge (L2). L3's Needs Focus reads
 * from the badge colour and the card's dot now — a pill in the row crowded the chips off
 * their line at 300px. Pass `onJump` to make rows jump links (reader); omit it for a
 * static read-only list (tracker, C2). Empty input renders the empty state (R6/C3).
 *
 * Mushaf order replaces L4's count-desc ranking — a grouped list has to run in reading
 * order, and the two can't both hold.
 */
export default function MarkedPagesList({
  rows, onJump, hrefFor, currentPage,
}: {
  rows: MarkedPage[];
  onJump?: (page: number) => void;
  /** Render each row as a link to this href (tracker: jump into the mushaf at that page). */
  hrefFor?: (page: number) => string;
  /** Opens that page's surah card on first render, so the panel starts where the reader is. */
  currentPage?: number;
}) {
  const { t, locale, fmtNum } = useI18n();
  const groups = React.useMemo(() => groupBySurah(rows), [rows]);

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

  // "1 page", not "1 pages" — the counts land on single-page surahs constantly.
  const pagesLabel = (n: number) => t(n === 1 ? 'reader.pagesCountOne' : 'reader.pagesCount', { n });
  const marksLabel = (n: number) => t(n === 1 ? 'reader.markCountOne' : 'reader.markCount', { n });

  if (rows.length === 0) {
    return (
      <p className="px-4 py-6 text-center" style={{ color: 'var(--text-muted)', fontSize: 'var(--type-small-size)' }}>
        {t('reader.noMarkedPages')}
      </p>
    );
  }

  const pageRow = (row: MarkedPage) => {
    const badge = BADGE_COLORS[badgeLevel(row.count)];
    const inner = (
      <>
        <span
          className="shrink-0 truncate"
          style={{ fontSize: 'var(--type-small-size)', fontWeight: 600, color: 'var(--text-primary)' }}
        >
          {t('reader.pageNum', { n: row.page })}
        </span>
        <ColorChips colors={row.colors} />
        <span
          className="shrink-0 inline-flex items-center justify-center tabular-nums"
          aria-label={marksLabel(row.count)}
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
    // Rows sit inside a surah card, so they run short and indent past its caret.
    const box: React.CSSProperties = {
      minHeight: '44px',
      paddingBlock: '8px',
      paddingInlineStart: '30px',
      background: 'transparent',
    };
    // marked-row carries hover / pressed / focus — see globals.css.
    const cls = 'marked-row flex w-full items-center gap-2 px-4 text-start';
    return (
      <li key={row.page}>
        {hrefFor ? (
          <a href={hrefFor(row.page)} className={cls} style={box}>
            {inner}
          </a>
        ) : onJump ? (
          <button type="button" onClick={() => onJump(row.page)} className={cls} style={box}>
            {inner}
          </button>
        ) : (
          // C2: read-only surface — static row, no jump/press affordance.
          <div className="flex w-full items-center gap-2 px-4" style={box}>
            {inner}
          </div>
        )}
      </li>
    );
  };

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
              className="marked-summary flex items-center gap-2 px-3"
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
                <span className="flex min-w-0 items-baseline gap-1.5">
                  <span className="truncate" style={{ fontSize: 'var(--type-small-size)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {getSurahName(group.surah, locale)}
                  </span>
                  {/* The Arabic name is how most readers know the surah — carried alongside the
                      transliteration, and dropped in the Arabic UI where it IS the name. */}
                  {locale !== 'ar' && (
                    <span className="shrink-0" style={{ fontSize: 'var(--type-meta-size)', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {getSurahName(group.surah, 'ar')}
                    </span>
                  )}
                </span>
                <span className="tabular-nums" style={{ fontSize: 'var(--type-meta-size)', fontWeight: 600, color: 'var(--text-muted)' }}>
                  {pagesLabel(group.pages.length)} · {marksLabel(group.count)}
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
              {group.pages.map(row => pageRow(row))}
            </ul>
          </details>
        );
      })}
    </div>
  );
}
