'use client';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { SURAH_PAGE_GROUPS, activeGroupPage, filterSurahGroups, getJuzForPage, getSurahsForPage, getSurahName, pageFromLocation, spreadOf, type SurahPageGroup } from '@/lib/quran';
import { pinStorageKey } from '@/lib/bookmark';
import { useI18n } from '@/components/I18nProvider';
import { sortMarked, type MarkedPage } from '@/lib/markedPages';
import MarkedPagesList from '@/components/MarkedPagesList';
import { useGoToPage } from '@/hooks/useGoToPage';
import { SegmentedControl } from '@/components/ui';

interface Props {
  onSelect?: (surahNumber: number) => void;
  currentPage?: number;
  basePath?: string;
  topOffset?: number;
  /** M6: when true, surah jumps target the spread URL containing the page (D3). */
  isSpread?: boolean;
  /** PRD 0009: marked pages for the active set (already fetched by the shell). Undefined ⇒
   *  the Marked tab isn't wired for this surface (kept hidden). */
  markedPages?: MarkedPage[];
}

export default function SurahNavPanel({ onSelect, currentPage: currentPageProp, basePath, topOffset = 72, isSpread = false, markedPages }: Props) {
  const { t, locale, fmtNum } = useI18n();
  const [tab, setTab] = useState<'surahs' | 'marked'>('surahs');
  const [query, setQuery] = useState('');
  const [pinnedPage, setPinnedPage] = useState<number | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const scrollListRef = useRef<HTMLDivElement | null>(null);
  const SCROLL_STORAGE_KEY = 'surahPanelScrollTop';
  const PIN_STORAGE_KEY = pinStorageKey(basePath);

  useEffect(() => {
    const raw = localStorage.getItem(PIN_STORAGE_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    setPinnedPage(!isNaN(n) && n > 0 ? n : null);
  }, [PIN_STORAGE_KEY]);

  const togglePin = (page: number) => {
    setPinnedPage(prev => {
      const next = prev === page ? null : page;
      if (next === null) localStorage.removeItem(PIN_STORAGE_KEY);
      else localStorage.setItem(PIN_STORAGE_KEY, String(next));
      return next;
    });
  };

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { goToPage } = useGoToPage({ basePath, isSpread });

  const currentPage = useMemo(
    () => (typeof currentPageProp === 'number' ? currentPageProp : pageFromLocation(pathname, searchParams)),
    [currentPageProp, pathname, searchParams],
  );

  const activePage = useMemo(() => activeGroupPage(currentPage), [currentPage]);

  // In spread mode the "selector" covers the whole 2-page spread: a row is active if
  // its page is the containing group OR falls within the current spread, so both pages
  // of the spread highlight together as one combined selection.
  const activeSpread = useMemo(() => (isSpread ? spreadOf(currentPage) : null), [isSpread, currentPage]);
  const isActiveGroup = (page: number) =>
    page === activePage || (activeSpread !== null && page >= activeSpread[0] && page <= activeSpread[1]);

  // Show a "jump to current" affordance when the active surah is scrolled out of
  // view — at the top (arrow up) when it's above, at the bottom (arrow down) below.
  const [jumpDir, setJumpDir] = useState<'up' | 'down' | null>(null);
  const jumpToActive = () =>
    activeButtonRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });

  const activeSurahName = useMemo(() => {
    const g = SURAH_PAGE_GROUPS.find(group => group.page === activePage);
    return g?.surahs.map(n => getSurahName(n, locale)).join(' · ') ?? '';
  }, [activePage]);

  const filtered = useMemo(() => filterSurahGroups(query), [query]);

  // Scroll to the active surah whenever the open page changes — EXCEPT when the change
  // came from a panel click (that path preserves the user's browse position, below).
  useEffect(() => {
    if (query.trim()) return;
    if (cameFromPanelRef.current) { cameFromPanelRef.current = false; return; }
    activeButtonRef.current?.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
  }, [activePage, query]);

  // The panel lives in the persistent reader shell, so it does NOT remount on page
  // navigation. We track the last user-driven scroll position in a ref (and mirror it
  // to sessionStorage so a full reload / share view also restores), then re-pin it
  // after each navigation to defeat the late, async scroll reset the new page triggers.
  const lastScrollTopRef = useRef<number>(0);
  const pinningRef = useRef<boolean>(false);
  const pendingTargetRef = useRef<number | null>(null);
  // Set by handleSelect so the scroll-to-active effect knows this nav was a panel click
  // (preserve position) rather than a URL / prev-next / bookmark nav (scroll to surah).
  const cameFromPanelRef = useRef(false);

  useEffect(() => {
    const el = scrollListRef.current;
    if (!el) return;
    const onScroll = () => {
      // While re-pinning after a navigation, ignore scroll events: they are either our
      // own reassertions or the page's spurious reset-to-0, neither of which should
      // overwrite the user's saved position.
      if (pinningRef.current) return;
      lastScrollTopRef.current = el.scrollTop;
      sessionStorage.setItem(SCROLL_STORAGE_KEY, String(el.scrollTop));
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [SCROLL_STORAGE_KEY]);

  // On a full reload, jump to the active surah (the page currently open) rather than
  // restoring a stale saved scroll. Pre-paint so there's no flash.
  useLayoutEffect(() => {
    const btn = activeButtonRef.current;
    if (!btn) return;
    btn.scrollIntoView({ block: 'center' });
    hasAutoScrolledRef.current = true;
  }, []); // run once on mount

  // Track whether the active surah row is visible inside the scroll list.
  useEffect(() => {
    const root = scrollListRef.current;
    const target = activeButtonRef.current;
    if (!root || !target) { setJumpDir(null); return; }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) { setJumpDir(null); return; }
        const above = e.boundingClientRect.top < (e.rootBounds?.top ?? 0);
        setJumpDir(above ? 'up' : 'down');
      },
      { root, threshold: 0.5 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [activePage, filtered]);

  // Re-pin the saved position after every navigation. The new page commits and then
  // asynchronously resets the (persistent) list's scrollTop, so we reassert across a
  // short window of frames, bailing the moment the user scrolls themselves.
  useEffect(() => {
    const el = scrollListRef.current;
    if (!el) return;
    // Only preserve position for a panel-click nav (handleSelect froze it here). Any other
    // nav (URL, prev/next, bookmark) has no frozen target and is left to the scroll-to-active
    // effect, so opening a reader path scrolls the list to the selected surah.
    const target = pendingTargetRef.current;
    pendingTargetRef.current = null;
    if (target === null || target <= 0) return;

    let cancelled = false;
    pinningRef.current = true;
    const stop = () => { cancelled = true; pinningRef.current = false; };
    el.addEventListener('wheel', stop, { passive: true });
    el.addEventListener('touchmove', stop, { passive: true });
    el.addEventListener('keydown', stop);

    const start = performance.now();
    const pin = () => {
      if (cancelled) return;
      if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
      if (performance.now() - start < 600) {
        requestAnimationFrame(pin);
      } else {
        pinningRef.current = false;
      }
    };
    requestAnimationFrame(pin);

    return () => {
      stop();
      el.removeEventListener('wheel', stop);
      el.removeEventListener('touchmove', stop);
      el.removeEventListener('keydown', stop);
    };
  }, [currentPage]);

  const handleSelect = async (group: SurahPageGroup) => {
    // Freeze the current list scroll position up front and guard it: flushing the canvas
    // and the route change both reset this (persistent, non-remounting) list to 0, so we
    // must capture before awaiting anything and ignore the intervening resets.
    cameFromPanelRef.current = true;
    const el = scrollListRef.current;
    if (el && el.scrollTop > 0) {
      pendingTargetRef.current = el.scrollTop;
      lastScrollTopRef.current = el.scrollTop;
      pinningRef.current = true;
    }

    onSelect?.(group.surahs[0] ?? 1);

    if (!(await goToPage(group.page))) {
      // No navigation will occur; release the guard so normal tracking resumes.
      pendingTargetRef.current = null;
      pinningRef.current = false;
      cameFromPanelRef.current = false;
    }
  };

  // R2: jump straight to a page (Marked-tab row) through the same shared routing as the
  // Surahs list, minus that list's scroll bookkeeping, which is irrelevant here.
  const jumpToPage = (page: number) => { void goToPage(page); };

  const markedRows = useMemo(() => sortMarked(markedPages ?? []), [markedPages]);
  // Distinct surahs touched, not cards: a page carrying a boundary counts toward both.
  const markedSurahCount = useMemo(
    () => new Set(markedRows.flatMap(r => getSurahsForPage(r.page))).size,
    [markedRows],
  );

  const panel = (
    <aside
      data-testid="surah-panel"
      className="panel-surface w-full flex flex-col h-full overflow-hidden border-l-0 border-y-0 rounded-none relative"
    >

      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        {markedPages === undefined ? (
          <h2
            className="font-semibold text-primary text-heading-m"
          >
            {t('reader.surahs')}
          </h2>
        ) : (
          // R1: two-tab header — Surahs (default) | Annotations.
          <div className="mb-3">
            <SegmentedControl
              tabs
              options={[
                { key: 'surahs', label: t('reader.surahs') },
                { key: 'marked', label: t('reader.marked') },
              ]}
              value={tab}
              onChange={k => setTab(k as 'surahs' | 'marked')}
            />
          </div>
        )}
        {tab === 'surahs' && activeSurahName && (
          <p className="mt-1 flex items-center gap-2 truncate text-small">
            <span className="shrink-0 tabular-nums px-2 py-0.5 rounded-full text-meta font-bold bg-green-soft text-green-600">
              {t('reader.juz', { n: getJuzForPage(activePage) })}
            </span>
            <span className="truncate text-secondary font-semibold">{activeSurahName}</span>
          </p>
        )}

        {tab === 'surahs' && (
        <div className="mt-3">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
              <circle cx="11" cy="11" r="6" strokeWidth={2} />
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={t('reader.searchSurah')}
              className="w-full input input-sm bg-surface-main pl-12"
              aria-label={t('reader.searchSurah')}
            />
          </div>
        </div>
        )}
      </div>

      {/* Marked tab (R1/R6). Kept as a sibling so the Surahs list below stays mounted with its
          scroll-restoration refs/effects intact when the user toggles tabs. Rows render via the
          shared MarkedPagesList (same list on the tracker), with jump links wired here. */}
      {markedPages !== undefined && tab === 'marked' && (
        <>
          {markedRows.length > 0 && (
            <div className="flex items-center gap-2 px-3 pb-2">
              <span className="tabular-nums px-2 py-0.5 rounded-full text-meta font-bold bg-green-soft text-green-600">
                {t(markedRows.length === 1 ? 'reader.pagesCountOne' : 'reader.pagesCount', { n: markedRows.length })}
              </span>
              <span className="text-meta font-semibold text-muted">
                {t('reader.surahsCount', { count: markedSurahCount })}
              </span>
            </div>
          )}
          <div data-testid="marked-scroll-list" className="flex-1 min-h-0 overflow-y-auto thin-scroll">
            <MarkedPagesList
              rows={markedRows}
              currentPage={currentPage}
              onJump={page => { void jumpToPage(page); }}
            />
          </div>
        </>
      )}

      <div
        ref={scrollListRef}
        data-testid="surah-scroll-list"
        className={`flex-1 min-h-0 overflow-y-auto thin-scroll ${markedPages !== undefined && tab === 'marked' ? 'hidden' : ''}`}
      >
        <ul>
          {filtered.map(group => {
            const active = isActiveGroup(group.page);
            return (
              <li key={group.page} className="group/row relative">
                <button
                  type="button"
                  onClick={() => togglePin(group.page)}
                  title={pinnedPage === group.page ? t('reader.removeBookmark') : t('reader.bookmarkAsDefault')}
                  aria-label={pinnedPage === group.page ? t('reader.removeDefaultBookmark') : t('reader.bookmarkAsDefault')}
                  aria-pressed={pinnedPage === group.page}
                  className={`absolute start-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center transition-opacity duration-150 ${
                    pinnedPage === group.page ? 'opacity-100 text-green-600' : 'opacity-0 text-muted focus-visible:opacity-100 group-hover/row:opacity-100'
                  }`}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill={pinnedPage === group.page ? 'currentColor' : 'none'} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1z" />
                  </svg>
                </button>
                <button
                  ref={group.page === activePage ? activeButtonRef : undefined}
                  type="button"
                  onClick={() => { void handleSelect(group); }}
                  className={`group flex w-full items-center gap-3 px-4 text-start transition-colors duration-150 min-h-18 py-5 ps-10 border-s-4 ${active ? 'bg-accent-muted border-s-green-600' : 'hover:bg-neutral-50 border-s-transparent'}`}
                >
                  <span className="min-w-0 flex-1 flex flex-col justify-center gap-2">
                    {group.surahs.map(n => (
                      <span key={n} className="flex items-center gap-3 min-w-0">
                        <span
                          className={`inline-flex shrink-0 items-center justify-center tabular-nums h-8 min-w-8 px-1.5 rounded-sm text-caption font-bold ${active ? 'bg-surface-main text-green-600' : 'bg-neutral-100 text-secondary'}`}
                        >
                          {fmtNum(n)}
                        </span>
                        <span
                          className={`block truncate leading-snug text-body ${active ? 'font-semibold text-green-800' : 'font-medium text-primary'}`}
                        >
                          {getSurahName(n, locale)}
                        </span>
                      </span>
                    ))}
                  </span>

                  <span
                    className={`shrink-0 tabular-nums px-2.5 py-1 rounded-sm text-meta font-semibold ${active ? 'bg-surface-main text-green-600' : 'bg-neutral-100 text-muted'}`}
                  >
                    {t('reader.pageNum', { n: group.page })}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {tab === 'surahs' && jumpDir && (
        <button
          type="button"
          onClick={jumpToActive}
          // Top variant clears the header (title + search); bottom clears the footer.
          className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 font-semibold animate-fade-in h-10 rounded-full bg-accent text-accent-contrast text-small shadow-e3 whitespace-nowrap max-w-[calc(100%-32px)] cursor-pointer ${
            jumpDir === 'up' ? 'top-35' : 'bottom-6'
          }`}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            {jumpDir === 'up' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5M5 12l7-7 7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M19 12l-7 7-7-7" />
            )}
          </svg>
          <span className="truncate">{activeSurahName || t('reader.currentSurah')}</span>
        </button>
      )}

    </aside>
  );

  return panel;
}
