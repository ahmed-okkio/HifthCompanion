'use client';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SURAH_PAGE_GROUPS, activeGroupPage, filterSurahGroups, getJuzForPage, getSurahName, pageFromLocation, spreadOf, spreadUrl, type SurahPageGroup } from '@/lib/quran';
import { pinStorageKey } from '@/lib/bookmark';

interface Props {
  onSelect?: (surahNumber: number) => void;
  currentPage?: number;
  basePath?: string;
  topOffset?: number;
  /** M6: when true, surah jumps target the spread URL containing the page (D3). */
  isSpread?: boolean;
}

export default function SurahNavPanel({ onSelect, currentPage: currentPageProp, basePath, topOffset = 72, isSpread = false }: Props) {
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

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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
    return g?.surahs.map(n => getSurahName(n)).join(' · ') ?? '';
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

    const flush = (window as any).__hifthFlushReaderCanvas as undefined | (() => Promise<void>);
    await flush?.();
    onSelect?.(group.surahs[0] ?? 1);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    const query = params.toString();
    const pageSeg = isSpread ? spreadUrl(group.page) : String(group.page);
    const targetPath = `${basePath ?? '/reader'}/${pageSeg}`;
    const targetHref = query ? `${targetPath}?${query}` : targetPath;
    const currentHref = query ? `${pathname}?${query}` : pathname;

    if (targetHref === currentHref) {
      // No navigation will occur; release the guard so normal tracking resumes.
      pendingTargetRef.current = null;
      pinningRef.current = false;
      cameFromPanelRef.current = false;
      return;
    }

    router.push(targetHref, { scroll: false });
  };


  const panel = (
    <aside
      data-testid="surah-panel"
      className="panel-surface w-full flex flex-col"
      style={{
        height: '100%',
        overflow: 'hidden',
        borderLeft: 'none',
        borderTop: 'none',
        borderBottom: 'none',
        borderRadius: 0,
        position: 'relative',
      }}
    >

      <div className="flex-shrink-0 px-4 pt-4 pb-3">
        <h2
          className="font-semibold"
          style={{ color: 'var(--text-primary)', fontSize: 'var(--type-heading-m-size)' }}
        >
          Surahs
        </h2>
        {activeSurahName && (
          <p className="mt-1 flex items-center gap-2 truncate" style={{ fontSize: 'var(--type-small-size)' }}>
            <span
              className="shrink-0 tabular-nums"
              style={{
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--type-meta-size)',
                fontWeight: 700,
                background: 'var(--green-soft)',
                color: 'var(--green-600)',
              }}
            >
              Juz {getJuzForPage(activePage)}
            </span>
            <span className="truncate" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{activeSurahName}</span>
          </p>
        )}

        <div className="mt-3">
          <div className="relative">
            <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
              <circle cx="11" cy="11" r="6" strokeWidth={2} />
            </svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search Surah"
              className="w-full input input-sm"
              aria-label="Search Surah"
              style={{ background: 'var(--surface-main)', paddingLeft: '3rem' }}
            />
          </div>
        </div>
      </div>

      <div ref={scrollListRef} data-testid="surah-scroll-list" className="flex-1 min-h-0 overflow-y-auto thin-scroll">
        <ul>
          {filtered.map(group => {
            const active = isActiveGroup(group.page);
            return (
              <li key={group.page} className="group/row relative">
                <button
                  type="button"
                  onClick={() => togglePin(group.page)}
                  title={pinnedPage === group.page ? 'Remove bookmark (default page)' : 'Bookmark as default page'}
                  aria-label={pinnedPage === group.page ? 'Remove default bookmark' : 'Bookmark as default page'}
                  aria-pressed={pinnedPage === group.page}
                  className="absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center opacity-0 transition-opacity duration-150 focus-visible:opacity-100 group-hover/row:opacity-100"
                  style={{
                    color: pinnedPage === group.page ? 'var(--green-600)' : 'var(--text-muted)',
                    opacity: pinnedPage === group.page ? 1 : undefined,
                  }}
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill={pinnedPage === group.page ? 'currentColor' : 'none'} stroke="currentColor" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1z" />
                  </svg>
                </button>
                <button
                  ref={group.page === activePage ? activeButtonRef : undefined}
                  type="button"
                  onClick={() => { void handleSelect(group); }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-50)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  className="group flex w-full items-center gap-3 px-4 text-left transition-colors duration-150"
                  style={{
                    minHeight: '72px',
                    paddingBlock: '20px',
                    paddingRight: '40px',
                    background: active ? 'var(--green-soft)' : 'transparent',
                    borderLeft: active
                      ? '4px solid var(--green-600)'
                      : '4px solid transparent',
                  }}
                >
                  <span className="min-w-0 flex-1 flex flex-col justify-center gap-2">
                    {group.surahs.map(n => (
                      <span key={n} className="flex items-center gap-3 min-w-0">
                        <span
                          className="inline-flex shrink-0 items-center justify-center tabular-nums"
                          style={{
                            height: '32px',
                            minWidth: '32px',
                            padding: '0 6px',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--type-caption-size)',
                            fontWeight: 700,
                            background: active ? 'var(--surface-main)' : 'var(--neutral-100)',
                            color: active ? 'var(--green-600)' : 'var(--text-secondary)',
                          }}
                        >
                          {n}
                        </span>
                        <span
                          className="block truncate leading-snug"
                          style={{
                            fontSize: 'var(--type-body-size)',
                            fontWeight: active ? 600 : 500,
                            color: active ? 'var(--green-800)' : 'var(--text-primary)',
                          }}
                        >
                          {getSurahName(n)}
                        </span>
                      </span>
                    ))}
                  </span>

                  <span
                    className="shrink-0 tabular-nums"
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: 'var(--type-meta-size)',
                      fontWeight: 600,
                      background: active ? 'var(--surface-main)' : 'var(--neutral-100)',
                      color: active ? 'var(--green-600)' : 'var(--text-muted)',
                    }}
                  >
                    Page {group.page}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {jumpDir && (
        <button
          type="button"
          onClick={jumpToActive}
          className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 font-semibold animate-fade-in"
          style={{
            // Top variant clears the header (title + search); bottom clears the footer.
            ...(jumpDir === 'up' ? { top: '140px' } : { bottom: '24px' }),
            height: '40px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--green-600)',
            color: '#fff',
            fontSize: 'var(--type-small-size)',
            boxShadow: 'var(--shadow-e3)',
            whiteSpace: 'nowrap',
            maxWidth: 'calc(100% - 32px)',
            cursor: 'pointer',
          }}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            {jumpDir === 'up' ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5M5 12l7-7 7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M19 12l-7 7-7-7" />
            )}
          </svg>
          <span className="truncate">{activeSurahName || 'Current surah'}</span>
        </button>
      )}

    </aside>
  );

  return panel;
}
