'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { AnnotationSet } from '@/types';
import { getPageImageUrl, clampPage } from '@/lib/quran';
import ReaderNav from './ReaderNav';
import SurahNavPanel from './SurahNavPanel';
import MobileSurahDrawer from './MobileSurahDrawer';
import AnnotationCanvas from './AnnotationCanvas';

const FALLBACK_NAV_HEIGHT = 72;

function readPageFromUrl(pathname: string, search: string): number {
  const qp = parseInt(new URLSearchParams(search).get('page') ?? '', 10);
  if (!isNaN(qp) && qp > 0) return qp;
  const match = pathname.match(/\/reader\/(\d+)|\/share\/[^/]+\/(\d+)/);
  if (match) return parseInt(match[1] || match[2], 10);
  return 1;
}

interface ReaderShellProps {
  children: React.ReactNode;
  user: { id: string } | null;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
}

export default function ReaderShell({ children, user, sets }: ReaderShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Soft page swap (Story 24): the page number is derived from the URL inside this
  // persistent layout shell, so navigating between /reader/N pages re-renders the canvas
  // with new props WITHOUT remounting it (the page segment that holds the notes column
  // still remounts, which is fine — notes are meant to swap). The Fabric canvas instance
  // therefore survives navigation and only its background image + objects are swapped.
  const pageNum = clampPage(readPageFromUrl(pathname, searchParams.toString()));
  const imageUrl = getPageImageUrl(pageNum);

  const navRef = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(FALLBACK_NAV_HEIGHT);
  const [surahOpen, setSurahOpen] = useState(false);

  useEffect(() => {
    const wrap = navRef.current;
    if (!wrap) return;
    // Measure the <nav> itself, not its wrapper: on mobile the nav is position:fixed (out of
    // flow), so the wrapper collapses to 0 height. Using the wrapper there left --nav-h at the
    // fallback and the fixed nav covered the top of the page. The nav element keeps its real
    // (possibly multi-row) height in both layouts.
    const navEl = wrap.querySelector('nav') ?? wrap;
    const measure = () => {
      const height = navEl.getBoundingClientRect().height;
      if (height > 0) setNavHeight(height);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(navEl);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      className="lg:h-[100dvh] lg:flex lg:flex-col lg:overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      <div ref={navRef} className="lg:flex-shrink-0">
        <ReaderNav currentPage={pageNum} onOpenSurah={() => setSurahOpen(true)} />
      </div>
      {/* On mobile the nav is position:fixed so content starts at top-0;
          --nav-h drives the mobile padding-top via CSS; lg: resets it to 0. */}
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
          <SurahNavPanel currentPage={pageNum} topOffset={navHeight} />
        </div>
        <div
          className="lg:h-full lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col"
          style={{ flex: 1, minWidth: 0 }}
        >
          {/* No transform-based animation here: the mobile annotation bar inside this
              subtree is position:fixed and a transformed ancestor (e.g. animate-fade-in,
              which keeps a computed matrix via animation-fill-mode: both) would make it the
              containing block, pinning the fixed bar to <main> instead of the viewport. */}
          <main className="w-full flex-grow px-4 py-6 sm:px-6 sm:py-8 mobile-bar-offset lg:flex lg:flex-col lg:justify-center lg:min-h-0 lg:overflow-hidden">
            <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-6 items-start lg:h-full lg:min-h-0 lg:items-start lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:justify-center">

              <div className="flex min-w-0 flex-col gap-4">
                <div className="mx-auto w-full">
                  {/* Persistent across page navigation — Fabric is not torn down (Story 24). */}
                  <AnnotationCanvas
                    pageNum={pageNum}
                    imageUrl={imageUrl}
                    sets={sets}
                    user={user}
                  />
                </div>
              </div>

              {/* The notes / share column is the per-page route segment; it remounts on page
                  change so its SSR-fetched notes swap cleanly. */}
              {children}

            </div>
          </main>
          <footer
            className="lg:hidden w-full text-center text-xs tracking-wider uppercase border-t"
            style={{ padding: '10px 0', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
          >
            HifthCompanion © 2026
          </footer>
        </div>
      </div>
      <MobileSurahDrawer open={surahOpen} onOpenChange={setSurahOpen} />
    </div>
  );
}
