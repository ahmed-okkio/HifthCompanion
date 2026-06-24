'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { AnnotationSet } from '@/types';
import { getPageImageUrl, clampPage } from '@/lib/quran';
import ReaderNav from './ReaderNav';
import SurahNavPanel from './SurahNavPanel';
import MobileSurahDrawer from './MobileSurahDrawer';
import AnnotationCanvas from './AnnotationCanvas';
import NavRail from './NavRail';

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
      {/* V3 Story 3 — desktop three-region workspace shell:
            [icon rail 72px + surah sidebar 260px] | flexible workspace | context panel 320px,
          24px gutters, against the fixed 100dvh app-shell. The left sidebar and the right
          context panel scroll internally; the workspace centers the canvas and does NOT scroll
          (lg:overflow-hidden preserves the no-document-scroll behavior). Mobile is unchanged:
          everything collapses to the single stacked column it was before. */}
      <div
        className="flex flex-col mobile-nav-offset lg:flex-1 lg:min-h-0 lg:flex-row lg:items-stretch lg:gap-6 lg:pr-6"
        style={{ ['--nav-h' as string]: `${navHeight}px`, background: 'var(--surface-app)' } as React.CSSProperties}
        suppressHydrationWarning
      >
        {/* REGION 1 — left navigation + surah sidebar.
            Icon rail (72px) is an empty placeholder column for now (Story 4 fills it); the
            surah sidebar (260px) carries the existing SurahNavPanel and its scroll logic. */}
        <div
          className="hidden lg:flex flex-shrink-0"
          style={{ height: '100%', overflow: 'hidden', zIndex: 1 }}
        >
          {/* Story 4 — Icon rail (72px). nav-rail-slot kept for backwards-compat with
              existing E2E selectors; nav-rail is the new canonical testid. */}
          <div
            data-testid="nav-rail-slot"
            className="flex-shrink-0"
            style={{ width: '72px', height: '100%' }}
          >
            <NavRail activeView="surahs" />
          </div>
          {/* Surah sidebar — 260px. */}
          <div
            className="flex flex-col flex-shrink-0"
            style={{
              width: '260px',
              height: '100%',
              overflow: 'hidden',
              background: 'var(--surface-main)',
              boxShadow: 'var(--shadow-e2)',
            }}
          >
            <SurahNavPanel currentPage={pageNum} topOffset={navHeight} />
          </div>
        </div>

        {/* REGION 2 — centered Quran workspace. Does not scroll on desktop. */}
        <div
          className="lg:h-full lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col lg:flex-1 lg:min-w-0"
          style={{ flex: 1, minWidth: 0, background: 'var(--surface-app)' }}
        >
          {/* No transform-based animation here: the mobile annotation bar inside this
              subtree is position:fixed and a transformed ancestor (e.g. animate-fade-in,
              which keeps a computed matrix via animation-fill-mode: both) would make it the
              containing block, pinning the fixed bar to <main> instead of the viewport. */}
          <main className="w-full flex-grow px-4 pt-6 pb-2 sm:px-6 sm:pt-8 lg:flex lg:flex-col lg:justify-center lg:min-h-0 lg:overflow-hidden lg:py-0">
            <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 items-stretch lg:h-full lg:min-h-0 lg:justify-center">

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

            </div>
          </main>
        </div>

        {/* REGION 3 — right context panel. Holds the per-page notes / share column (the route
            children, rendered exactly once so the single NotesPanel/canvas stay mounted).
            Desktop: a 320px column that scrolls internally. Mobile: full-width, in normal
            document flow below the workspace (the layout it had before this story), carrying
            the fixed-bottom-bar offset. Card contents are restyled in Stories 13–15; here it
            scaffolds the slot. */}
        {/* V3 Story 16: mobile-context-panel testid added (context-panel preserved for desktop E2E) */}
        <div
          data-testid="context-panel"
          data-mobile-testid="mobile-context-panel"
          className="w-full px-4 pb-[calc(56px+env(safe-area-inset-bottom,0px))] sm:px-6 lg:flex lg:flex-col lg:flex-shrink-0 lg:w-[320px] lg:px-0 lg:pb-0 lg:h-full lg:min-h-0 lg:overflow-y-auto thin-scroll"
          style={{ paddingTop: 'var(--space-24)' }}
        >
          {/* Sets card portal target — AnnotationCanvas renders the SetsCard here (top of the
              right panel) so the set selector + "New set" share the canvas state. */}
          <div id="sets-card-portal" className="mb-4 empty:mb-0" />
          {children}
          <footer
            className="lg:hidden w-full text-center text-xs tracking-wider uppercase border-t mt-6"
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
