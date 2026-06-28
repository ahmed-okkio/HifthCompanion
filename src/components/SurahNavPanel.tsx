'use client';
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SURAH_FIRST_PAGES } from '@/lib/quran';

export type Surah = {
  number: number;
  name: string;
  englishName?: string;
  verses?: number;
};

type SurahPageGroup = {
  page: number;
  surahs: Surah[];
};

// Hard-coded list of 114 surahs (names only). Verse counts are omitted for brevity.
// Exported so other components (e.g. ReaderNav breadcrumb) can look up a surah name.
export const SURAH_LIST: Surah[] = [
  { number: 1, name: "Al-Fatihah" },
  { number: 2, name: "Al-Baqarah" },
  { number: 3, name: "Aal-i-Imran" },
  { number: 4, name: "An-Nisa'" },
  { number: 5, name: "Al-Ma'idah" },
  { number: 6, name: "Al-An'am" },
  { number: 7, name: "Al-A'raf" },
  { number: 8, name: "Al-Anfal" },
  { number: 9, name: "At-Tawbah" },
  { number: 10, name: "Yunus" },
  { number: 11, name: "Hud" },
  { number: 12, name: "Yusuf" },
  { number: 13, name: "Ar-Ra'd" },
  { number: 14, name: "Ibrahim" },
  { number: 15, name: "Al-Hijr" },
  { number: 16, name: "An-Nahl" },
  { number: 17, name: "Al-Isra'" },
  { number: 18, name: "Al-Kahf" },
  { number: 19, name: "Maryam" },
  { number: 20, name: "Ta-Ha" },
  { number: 21, name: "Al-Anbiya" },
  { number: 22, name: "Al-Hajj" },
  { number: 23, name: "Al-Mu'minun" },
  { number: 24, name: "An-Nur" },
  { number: 25, name: "Al-Furqan" },
  { number: 26, name: "Ash-Shu'ara'" },
  { number: 27, name: "An-Naml" },
  { number: 28, name: "Al-Qasas" },
  { number: 29, name: "Al-Ankabut" },
  { number: 30, name: "Ar-Rum" },
  { number: 31, name: "Luqman" },
  { number: 32, name: "As-Sajdah" },
  { number: 33, name: "Al-Ahzab" },
  { number: 34, name: "Saba" },
  { number: 35, name: "Fatir" },
  { number: 36, name: "Ya-Sin" },
  { number: 37, name: "As-Saffat" },
  { number: 38, name: "Sad" },
  { number: 39, name: "Az-Zumar" },
  { number: 40, name: "Ghafir" },
  { number: 41, name: "Fussilat" },
  { number: 42, name: "Ash-Shura" },
  { number: 43, name: "Az-Zukhruf" },
  { number: 44, name: "Ad-Dukhan" },
  { number: 45, name: "Al-Jathiyah" },
  { number: 46, name: "Al-Ahqaf" },
  { number: 47, name: "Muhammad" },
  { number: 48, name: "Al-Fath" },
  { number: 49, name: "Al-Hujurat" },
  { number: 50, name: "Qaf" },
  { number: 51, name: "Adh-Dhariyat" },
  { number: 52, name: "At-Tur" },
  { number: 53, name: "An-Najm" },
  { number: 54, name: "Al-Qamar" },
  { number: 55, name: "Ar-Rahman" },
  { number: 56, name: "Al-Waqi'" },
  { number: 57, name: "Al-Hadid" },
  { number: 58, name: "Al-Mujadila" },
  { number: 59, name: "Al-Hashr" },
  { number: 60, name: "Al-Mumtahanah" },
  { number: 61, name: "As-Saff" },
  { number: 62, name: "Al-Jumu'ah" },
  { number: 63, name: "Al-Munafiqun" },
  { number: 64, name: "At-Taghabun" },
  { number: 65, name: "At-Talaq" },
  { number: 66, name: "At-Tahrim" },
  { number: 67, name: "Al-Mulk" },
  { number: 68, name: "Al-Qalam" },
  { number: 69, name: "Al-Haqqah" },
  { number: 70, name: "Al-Ma'arij" },
  { number: 71, name: "Nuh" },
  { number: 72, name: "Al-Jinn" },
  { number: 73, name: "Al-Muzzammil" },
  { number: 74, name: "Al-Muddathir" },
  { number: 75, name: "Al-Qiyamah" },
  { number: 76, name: "Al-Insan" },
  { number: 77, name: "Al-Mursalat" },
  { number: 78, name: "An-Naba'" },
  { number: 79, name: "An-Nazi'at" },
  { number: 80, name: "Abasa" },
  { number: 81, name: "At-Takwir" },
  { number: 82, name: "Al-Infitar" },
  { number: 83, name: "Al-Mutaffifin" },
  { number: 84, name: "Al-Inshiqaq" },
  { number: 85, name: "Al-Buruj" },
  { number: 86, name: "At-Tariq" },
  { number: 87, name: "Al-Ala" },
  { number: 88, name: "Al-Ghashiyah" },
  { number: 89, name: "Al-Fajr" },
  { number: 90, name: "Al-Balad" },
  { number: 91, name: "Ash-Shams" },
  { number: 92, name: "Al-Layl" },
  { number: 93, name: "Ad-Duha" },
  { number: 94, name: "Ash-Sharh" },
  { number: 95, name: "At-Tin" },
  { number: 96, name: "Al-Alaq" },
  { number: 97, name: "Al-Qadr" },
  { number: 98, name: "Al-Bayyinah" },
  { number: 99, name: "Az-Zalzalah" },
  { number: 100, name: "Al-Adiyat" },
  { number: 101, name: "Al-Qari'ah" },
  { number: 102, name: "At-Takathur" },
  { number: 103, name: "Al-Asr" },
  { number: 104, name: "Al-Humazah" },
  { number: 105, name: "Al-Fil" },
  { number: 106, name: "Quraysh" },
  { number: 107, name: "Al-Maun" },
  { number: 108, name: "Al-Kawthar" },
  { number: 109, name: "Al-Kafirun" },
  { number: 110, name: "An-Nasr" },
  { number: 111, name: "Al-Masad" },
  { number: 112, name: "Al-Ikhlas" },
  { number: 113, name: "Al-Falaq" },
  { number: 114, name: "An-Nas" },
];

interface Props {
  surahs?: Surah[];
  initialSelected?: number;
  onSelect?: (surahNumber: number) => void;
  currentPage?: number;
  basePath?: string;
  topOffset?: number;
}

export default function SurahNavPanel({ surahs = SURAH_LIST, initialSelected, onSelect, currentPage: currentPageProp, basePath, topOffset = 72 }: Props) {
  const [query, setQuery] = useState('');
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const scrollListRef = useRef<HTMLDivElement | null>(null);
  const SCROLL_STORAGE_KEY = 'surahPanelScrollTop';

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = useMemo(() => {
    if (typeof currentPageProp === 'number') {
      return currentPageProp;
    }

    const qp = parseInt(searchParams.get('page') ?? '', 10);
    if (!isNaN(qp) && qp > 0) return qp;

    const readerMatch = pathname.match(/^\/reader\/(\d+)/);
    if (readerMatch) return Number.parseInt(readerMatch[1], 10);

    const shareMatch = pathname.match(/^\/share\/[^/]+\/(\d+)/);
    if (shareMatch) return Number.parseInt(shareMatch[1], 10);

    return 1;
  }, [currentPageProp, pathname, searchParams]);

  const groupedSurahs = useMemo<SurahPageGroup[]>(() => {
    const groups = new Map<number, Surah[]>();
    surahs.forEach(surah => {
      const page = SURAH_FIRST_PAGES[surah.number];
      if (!groups.has(page)) groups.set(page, []);
      groups.get(page)!.push(surah);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([page, groupSurahs]) => ({ page, surahs: groupSurahs }));
  }, [surahs]);

  const activePage = useMemo(() => {
    let page = SURAH_FIRST_PAGES[initialSelected ?? 1] ?? 1;
    for (const group of groupedSurahs) {
      if (group.page <= currentPage) page = group.page;
      else break;
    }
    return page;
  }, [currentPage, groupedSurahs, initialSelected]);

  // Show a "jump to current" affordance when the active surah is scrolled out of
  // view — at the top (arrow up) when it's above, at the bottom (arrow down) below.
  const [jumpDir, setJumpDir] = useState<'up' | 'down' | null>(null);
  const jumpToActive = () =>
    activeButtonRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });

  const activeSurahName = useMemo(() => {
    const g = groupedSurahs.find(group => group.page === activePage);
    return g?.surahs.map(s => s.name).join(' · ') ?? '';
  }, [groupedSurahs, activePage]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groupedSurahs;
    return groupedSurahs.filter(group => (
      `${group.page}`.includes(q)
      || group.surahs.some(surah => (
        `${surah.number}`.includes(q)
        || surah.name.toLowerCase().includes(q)
        || (surah.englishName || '').toLowerCase().includes(q)
      ))
    ));
  }, [groupedSurahs, query]);

  useEffect(() => {
    if (query.trim()) return;
    if (hasAutoScrolledRef.current) return;
    if (!activeButtonRef.current) return;
    activeButtonRef.current.scrollIntoView({
      block: 'center',
      inline: 'nearest',
      behavior: 'smooth',
    });
    hasAutoScrolledRef.current = true;
  }, [activePage, query]);

  // The panel lives in the persistent reader shell, so it does NOT remount on page
  // navigation. We track the last user-driven scroll position in a ref (and mirror it
  // to sessionStorage so a full reload / share view also restores), then re-pin it
  // after each navigation to defeat the late, async scroll reset the new page triggers.
  const lastScrollTopRef = useRef<number>(0);
  const pinningRef = useRef<boolean>(false);
  const pendingTargetRef = useRef<number | null>(null);

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
    // Prefer the position frozen at navigation start (handleSelect); fall back to the
    // last tracked scroll for navigations that bypass it (e.g. page jumper, back/forward).
    const target = pendingTargetRef.current ?? lastScrollTopRef.current;
    pendingTargetRef.current = null;
    if (target <= 0) return;

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
    const el = scrollListRef.current;
    if (el && el.scrollTop > 0) {
      pendingTargetRef.current = el.scrollTop;
      lastScrollTopRef.current = el.scrollTop;
      pinningRef.current = true;
    }

    const flush = (window as any).__hifthFlushReaderCanvas as undefined | (() => Promise<void>);
    await flush?.();
    onSelect?.(group.surahs[0]?.number ?? 1);

    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    const query = params.toString();
    const targetPath = `${basePath ?? '/reader'}/${group.page}`;
    const targetHref = query ? `${targetPath}?${query}` : targetPath;
    const currentHref = query ? `${pathname}?${query}` : pathname;

    if (targetHref === currentHref) {
      // No navigation will occur; release the guard so normal tracking resumes.
      pendingTargetRef.current = null;
      pinningRef.current = false;
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
          <p className="mt-0.5 truncate" style={{ color: 'var(--text-muted)', fontSize: 'var(--type-small-size)' }}>
            Juz — · <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{activeSurahName}</span>
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
            const active = activePage === group.page;
            return (
              <li key={group.page}>
                <button
                  ref={active ? activeButtonRef : undefined}
                  type="button"
                  onClick={() => { void handleSelect(group); }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'var(--neutral-50)'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  className="group flex w-full items-center gap-3 px-4 text-left transition-colors duration-150"
                  style={{
                    minHeight: '72px',
                    paddingBlock: '20px',
                    background: active ? 'var(--green-soft)' : 'transparent',
                    borderLeft: active
                      ? '4px solid var(--green-600)'
                      : '4px solid transparent',
                  }}
                >
                  <span className="min-w-0 flex-1 flex flex-col justify-center gap-2">
                    {group.surahs.map(s => (
                      <span key={s.number} className="flex items-center gap-3 min-w-0">
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
                          {s.number}
                        </span>
                        <span
                          className="block truncate leading-snug"
                          style={{
                            fontSize: 'var(--type-body-size)',
                            fontWeight: active ? 600 : 500,
                            color: active ? 'var(--green-800)' : 'var(--text-primary)',
                          }}
                        >
                          {s.name}
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
            ...(jumpDir === 'up' ? { top: '140px' } : { bottom: '84px' }),
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

      <div className="flex-shrink-0 px-4 py-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <button
          type="button"
          aria-disabled="true"
          title="Add to My Sets (coming soon)"
          className="flex w-full items-center justify-center gap-2 font-semibold opacity-60 cursor-default"
          style={{
            minHeight: '44px',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border-subtle)',
            background: 'var(--surface-main)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--type-small-size)',
          }}
          onClick={e => e.preventDefault()}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v14M5 12h14" />
          </svg>
          Add to My Sets
        </button>
      </div>
    </aside>
  );

  return panel;
}
