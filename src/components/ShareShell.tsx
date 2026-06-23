'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TOTAL_PAGES, clampPage } from '@/lib/quran';
import SurahNavPanel from './SurahNavPanel';
import MobileSurahDrawer from './MobileSurahDrawer';
import shareStyles from './ShareShell.module.css';

const FALLBACK_NAV_HEIGHT = 56;

interface Props {
  userId: string;
  pageNum: number;
  setId: string;
  setName: string;
  children: React.ReactNode;
}

/**
 * Share view shell — mirrors ReaderShell's layout (Story 14): a 100dvh flex
 * column with the share header at the top, a left surah panel that scrolls
 * internally on desktop, and a centered read-only page. On mobile the header is
 * fixed chrome and the content scrolls beneath it, with the surah list living in
 * the bottom-sheet (opened from the header). Read-only throughout — no annotation
 * toolbar, so there is no fixed bottom bar to pad against.
 */
export default function ShareShell({ userId, pageNum, setId, setName, children }: Props) {
  const navRef = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(FALLBACK_NAV_HEIGHT);
  const [surahOpen, setSurahOpen] = useState(false);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const measure = () => {
      const height = el.getBoundingClientRect().height;
      if (height > 0) setNavHeight(height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const prevPage = clampPage(pageNum - 1);
  const nextPage = clampPage(pageNum + 1);

  return (
    <div
      className="lg:h-[100dvh] lg:flex lg:flex-col lg:overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* On mobile the header is position:fixed (see ShareShell.module.css); on
          desktop it sits in-flow at the top of the flex column. */}
      <div ref={navRef} className={`${shareStyles.headerWrap} lg:flex-shrink-0`}>
        <header
          className="glass w-full"
          style={{ borderBottom: '1px solid var(--border-subtle)', borderRadius: 0 }}
        >
          <div className="mx-auto flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4 sm:py-2.5 max-w-4xl lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-1 items-center justify-start gap-2 sm:gap-3 lg:flex-initial">
              <button
                type="button"
                onClick={() => setSurahOpen(true)}
                title="Open surah list"
                aria-label="Open surah list"
                className={`${shareStyles.surahButton} lg:hidden`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
              <Link href={`/share/${userId}/${prevPage}?set=${setId}`}>
                <button
                  disabled={pageNum === 1}
                  className="btn btn-ghost flex items-center gap-1"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </button>
              </Link>

              <div className="flex items-center gap-1.5 tabular-nums text-sm font-bold"
                   style={{ color: 'var(--text-primary)' }}>
                <span>{pageNum}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{TOTAL_PAGES}</span>
              </div>

              <Link href={`/share/${userId}/${nextPage}?set=${setId}`}>
                <button
                  disabled={pageNum === TOTAL_PAGES}
                  className="btn btn-ghost flex items-center gap-1"
                  style={{ padding: '4px 10px', fontSize: '12px' }}
                >
                  Next
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </Link>
            </div>

            <div className="flex min-w-0 items-center justify-start gap-2.5 lg:justify-center">
              <span className="badge max-w-[40vw] truncate sm:max-w-none">{setName}</span>
              <span className="badge badge-muted flex-shrink-0">Read-only</span>
            </div>

            <div className="flex min-w-0 flex-1 items-center justify-end lg:flex-initial">
              <Link href="/reader/1"
                    className="btn btn-outline flex items-center gap-1"
                    style={{ padding: '4px 12px', fontSize: '12px' }}>
                Open Reader
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </Link>
            </div>
          </div>
        </header>
      </div>

      {/* Content row: fills the remaining height on desktop. On mobile the nav is
          position:fixed, so --nav-h drives the padding-top via mobile-nav-offset. */}
      <div
        className="lg:flex-1 lg:min-h-0 mobile-nav-offset"
        style={{ display: 'flex', alignItems: 'flex-start', ['--nav-h' as string]: `${navHeight}px` } as React.CSSProperties}
        suppressHydrationWarning
      >
        <div
          className="hidden lg:flex lg:flex-col flex-shrink-0"
          style={{
            height: '100%',
            width: '288px',
            overflow: 'hidden',
          }}
        >
          <SurahNavPanel currentPage={pageNum} basePath={`/share/${userId}`} topOffset={navHeight} />
        </div>
        <div
          className="lg:h-full lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col"
          style={{ flex: 1, minWidth: 0 }}
        >
          {children}
        </div>
      </div>

      <MobileSurahDrawer open={surahOpen} onOpenChange={setSurahOpen} basePath={`/share/${userId}`} />
    </div>
  );
}
