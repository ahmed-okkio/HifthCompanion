'use client';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AnnotationSet } from '@/types';
import { getPageImageUrl, clampPage, spreadUrl } from '@/lib/quran';
import { SPREAD_MODE_KEY } from './SpreadToggle';
import ReaderNav from './ReaderNav';
import SurahNavPanel from './SurahNavPanel';
import MobileSurahDrawer from './MobileSurahDrawer';
import MobileNavDrawer from './MobileNavDrawer';
import AnnotationCanvas from './AnnotationCanvas';
import SpreadAnnotation from './SpreadAnnotation';
import NavRail from './NavRail';
import { createClient } from '@/lib/supabase/client';
import { markedPages as fetchMarkedPages } from '@/lib/services/markedPages';
import type { MarkedPage } from '@/lib/markedPages';

const FALLBACK_NAV_HEIGHT = 72;

/** Shared shimmer gradient style for skeleton blocks. */
const SHIMMER: React.CSSProperties = {
  background: 'linear-gradient(90deg, rgba(15,23,42,0.04) 0%, rgba(15,23,42,0.08) 50%, rgba(15,23,42,0.04) 100%)',
  backgroundSize: '200% 100%',
  animation: 'shimmer 1.4s linear infinite',
  borderRadius: 'var(--radius-md, 8px)',
};

/** Full-shell skeleton shown while a redirect is pending.
 *  Mirrors all three regions so the entire page appears at once after the redirect. */
function ShellSkeleton() {
  return (
    <>
      {/* REGION 1 skeleton — nav rail + surah sidebar (desktop only) */}
      <div className="hidden lg:flex flex-shrink-0" style={{ height: '100%', overflow: 'hidden', zIndex: 1 }}>
        {/* Nav rail slot */}
        <div className="flex-shrink-0" style={{ width: '96px', height: '100%' }}>
          <NavRail />
        </div>
        {/* Surah sidebar skeleton */}
        <div
          className="flex flex-col flex-shrink-0 gap-3"
          style={{
            width: '300px', height: '100%', overflow: 'hidden',
            background: 'var(--surface-main)', boxShadow: 'var(--shadow-e2)',
            padding: '16px 12px',
          }}
        >
          {/* Search bar skeleton */}
          <div style={{ ...SHIMMER, height: '40px', width: '100%' }} />
          {/* Surah list item skeletons */}
          {Array.from({ length: 12 }, (_, i) => (
            <div key={i} style={{ ...SHIMMER, height: '36px', width: `${85 - (i % 3) * 10}%` }} />
          ))}
        </div>
      </div>

      {/* REGION 2 skeleton — canvas workspace */}
      <div
        className="lg:h-full lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col lg:flex-1 lg:min-w-0"
        style={{ flex: 1, minWidth: 0, background: 'var(--surface-app)' }}
      >
        <main className="w-full flex-grow px-4 pt-6 pb-2 sm:px-6 sm:pt-8 lg:flex lg:flex-col lg:justify-center lg:min-h-0 lg:overflow-hidden lg:py-0">
          <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 items-stretch lg:h-full lg:min-h-0 lg:justify-center">
            <div className="mx-auto w-fit">
              <div
                style={{
                  width: 'clamp(280px, 40vw, 540px)',
                  aspectRatio: '0.704', /* Quran page ~= 1:1.42 */
                  borderRadius: 'var(--radius-page, 12px)',
                  ...SHIMMER,
                  boxShadow: '0 6px 16px rgba(15, 23, 42, 0.10)',
                }}
              />
            </div>
          </div>
        </main>
      </div>

      {/* REGION 3 skeleton — context panel */}
      <div
        className="w-full px-4 sm:px-6 lg:flex lg:flex-col lg:flex-shrink-0 lg:w-[320px] lg:px-0 lg:h-full lg:min-h-0"
        style={{ paddingTop: 'var(--space-24)' }}
      >
        <div className="flex flex-col gap-4">
          {/* Sets card skeleton */}
          <div style={{ ...SHIMMER, height: '52px', width: '100%' }} />
          {/* Notes / share panel skeleton */}
          <div style={{ ...SHIMMER, height: '160px', width: '100%' }} />
          <div style={{ ...SHIMMER, height: '100px', width: '80%' }} />
        </div>
      </div>
    </>
  );
}


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
  /** Signed-in user's chrome summary (name + email), or null when logged out. */
  account?: { name: string; email: string } | null;
  /** Collaborator share view: lock the canvas to the single shared set (hides the swapper). */
  lockedSet?: boolean;
  /** Optional banner rendered above the canvas in region 2 (e.g. "Editing X's Mushaf"). */
  banner?: React.ReactNode;
  /** When set (e.g. `/share/{setId}`), nav + surah links target the share route instead of /reader. */
  sharePageBasePath?: string;
}

export default function ReaderShell({ children, user, sets, account = null, lockedSet = false, banner, sharePageBasePath }: ReaderShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  // Spread mode (M2): `/reader/N-M`. Derived from the same pathname the page number is read
  // from — no prop plumbing, since this shell lives in the layout and never sees the route
  // param. M3 reads `spread` here to light up the second canvas. `null` ⇒ single-page mode.
  // Anchored to the LAST path segment so a uuid in the share base (`/share/{uuid}/N-M`)
  // — which itself contains digit-hyphen-digit runs — can't be misread as a spread pair.
  const spreadBase = sharePageBasePath ?? '/reader';
  const spreadMatch = pathname.match(/\/(\d+)-(\d+)$/);
  const spread: [number, number] | null = spreadMatch
    ? [parseInt(spreadMatch[1], 10), parseInt(spreadMatch[2], 10)]
    : null;

  // E1: on a narrow (sub-lg, <1024px) viewport a spread collapses to the lower/right single
  // page. Detection is CSS-only in this codebase, so the redirect fires from a client effect.
  useEffect(() => {
    if (!spread) return;
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => { if (mq.matches) router.replace(`${spreadBase}/${spread[0]}`); };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);
  // Soft page swap (Story 24): the page number is derived from the URL inside this
  // persistent layout shell, so navigating between /reader/N pages re-renders the canvas
  // with new props WITHOUT remounting it (the page segment that holds the notes column
  // still remounts, which is fine — notes are meant to swap). The Fabric canvas instance
  // therefore survives navigation and only its background image + objects are swapped.
  const pageNum = clampPage(readPageFromUrl(pathname, searchParams.toString()));
  const imageUrl = getPageImageUrl(pageNum);

  // C3: apply the persisted spread preference on load (and on each /reader nav). Desktop-only —
  // the >=lg guard makes this disjoint from the mobile redirect (E1, <=1023px), so the two can
  // never ping-pong: on a narrow screen only the mobile effect runs, on a wide screen only this
  // one. Share routes never go spread, so skip them. Each branch settles in one hop (toggling to
  // the target state makes its own condition false on the re-render).
  useEffect(() => {
    if (!window.matchMedia('(min-width: 1024px)').matches) return;
    // Don't apply spread preference on the bare index route (/reader) — the
    // ReaderIndexPage handles its own redirect there, including the pinned
    // surah bookmark.  Without this guard, C3 fires second (parent effect)
    // and clobbers the child's pinned-surah redirect with page 1.
    if (pathname === spreadBase || pathname === `${spreadBase}/`) return;
    const raw = localStorage.getItem(SPREAD_MODE_KEY);
    if (raw === '1' && !spread) router.replace(`${spreadBase}/${spreadUrl(pageNum)}`);
    else if (raw === '0' && spread) router.replace(`${spreadBase}/${spread[0]}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Detect any URL state that will trigger an immediate redirect so we can show a skeleton
  // instead of the wrong canvas layout. This covers:
  //   1. Bare index route (/reader) — ReaderIndexPage reads pinned page + spread pref
  //   2. Spread/single mode mismatch — C3 effect will redirect (desktop only)
  //   3. Mobile spread URL — E1 effect will collapse to single page
  // Using state so it's only computed once after hydration (avoids SSR mismatch on
  // window/localStorage reads). Resets on every pathname change.
  const [pendingRedirect, setPendingRedirect] = useState(true);
  useEffect(() => {
    const isIndex = pathname === spreadBase || pathname === `${spreadBase}/`;
    if (isIndex) { setPendingRedirect(true); return; }

    const isDesktop = window.matchMedia('(min-width: 1024px)').matches;
    const spreadPref = localStorage.getItem(SPREAD_MODE_KEY);

    // Mode mismatch: pref says spread but URL is single (or vice versa) on desktop
    const wantsSpread = spreadPref === '1' && !spread && isDesktop;
    const wantsSingle = spreadPref === '0' && !!spread && isDesktop;
    // Mobile + spread URL → E1 will collapse
    const mobileSpread = !isDesktop && !!spread;

    setPendingRedirect(wantsSpread || wantsSingle || mobileSpread);
  }, [pathname, spread, spreadBase]);

  // PRD 0009 R3/R5: marked-pages aggregate for the active set. Fetched ONCE per set (initial
  // load + set-switch); page navigation never refetches (this shell is persistent). Draw-saves
  // patch a single page's count in place via patchMarked (wired to the canvas onSaved callback).
  const activeSetId = searchParams.get('set') ?? sets[0]?.id ?? '';
  const [markedRows, setMarkedRows] = useState<MarkedPage[]>([]);
  useEffect(() => {
    if (!user || !activeSetId) { setMarkedRows([]); return; }
    let cancelled = false;
    fetchMarkedPages(createClient(), activeSetId)
      .then(rows => { if (!cancelled) setMarkedRows(rows); })
      .catch(() => { if (!cancelled) setMarkedRows([]); });
    return () => { cancelled = true; };
  }, [activeSetId, user]);

  // R3/R4: upsert the saved page's count in memory (count 0 removes the row). No refetch.
  // Ignore saves for a different set — a set-switch flushes the OUTGOING set, whose onSaved
  // would otherwise pollute the incoming set's list (draw in set A showing in set B).
  const patchMarked = useCallback((setId: string, page: number, count: number) => {
    if (setId !== activeSetId) return;
    setMarkedRows(prev => {
      const rest = prev.filter(r => r.page !== page);
      return count > 0 ? [...rest, { page, count }] : rest;
    });
  }, [activeSetId]);

  const navRef = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(FALLBACK_NAV_HEIGHT);
  const [surahOpen, setSurahOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

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
        <ReaderNav
          currentPage={pageNum}
          onOpenSurah={() => setSurahOpen(true)}
          onOpenNav={() => setNavOpen(true)}
          account={account}
          sharePageBasePath={sharePageBasePath}
          isSpread={!!spread}
        />
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
        {pendingRedirect ? (
          <>
            <ShellSkeleton />
            {/* Children must stay mounted (hidden) so page-level effects (e.g. the index
                redirect in ReaderIndexPage) still fire and resolve the pending redirect. */}
            <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', pointerEvents: 'none' }} aria-hidden>
              {children}
            </div>
          </>
        ) : (
          <>
            {/* REGION 1 — left navigation + surah sidebar.
                Icon rail (72px) is an empty placeholder column for now (Story 4 fills it); the
                surah sidebar (260px) carries the existing SurahNavPanel and its scroll logic. */}
            <div
              className="hidden lg:flex flex-shrink-0"
              style={{ height: '100%', overflow: 'hidden', zIndex: 1 }}
            >
              <div
                data-testid="nav-rail-slot"
                className="flex-shrink-0"
                style={{ width: '96px', height: '100%' }}
              >
                <NavRail />
              </div>
              {/* Surah sidebar — 260px. */}
              <div
                className="flex flex-col flex-shrink-0"
                style={{
                  width: '300px',
                  height: '100%',
                  overflow: 'hidden',
                  background: 'var(--surface-main)',
                  boxShadow: 'var(--shadow-e2)',
                }}
              >
                <SurahNavPanel currentPage={pageNum} topOffset={navHeight} basePath={sharePageBasePath} isSpread={!!spread} markedPages={markedRows} />
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

                  {banner}

                  <div className="flex min-w-0 flex-col gap-4">
                    <div className="mx-auto w-full">
                      {/* Persistent across page navigation — Fabric is not torn down (Story 24).
                          M3: in spread mode (`/reader/N-M`, desktop only — E1 redirects narrow
                          viewports to single) we mount TWO independent persistent canvases. Each
                          has its own refs/Fabric instance inside useAnnotationCanvas, so they
                          soft-swap (background+objects) on spread→spread nav without disposing
                          (__hifthFabricCreatedCount stays 2). Each saves to its own page_number.
                          RTL (B2): flex-row-reverse puts the DOM-first lower/odd page on the RIGHT
                          and the higher/even page on the LEFT, while data stays page-numeric. */}
                      {spread ? (
                        <SpreadAnnotation
                          pages={spread}
                          sets={sets}
                          user={user}
                          lockedSet={lockedSet}
                          sharePageBasePath={sharePageBasePath}
                          onSaved={patchMarked}
                        />
                      ) : (
                        <AnnotationCanvas
                          pageNum={pageNum}
                          imageUrl={imageUrl}
                          sets={sets}
                          user={user}
                          lockedSet={lockedSet}
                          sharePageBasePath={sharePageBasePath}
                          onSaved={patchMarked}
                        />
                      )}
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
              className="w-full px-4 pb-[calc(88px+env(safe-area-inset-bottom,0px))] sm:px-6 lg:flex lg:flex-col lg:flex-shrink-0 lg:w-[320px] lg:px-0 lg:pb-0 lg:h-full lg:min-h-0 lg:overflow-y-auto thin-scroll"
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
          </>
        )}
      </div>
      <MobileSurahDrawer open={surahOpen} onOpenChange={setSurahOpen} basePath={sharePageBasePath} isSpread={!!spread} />
      <MobileNavDrawer open={navOpen} onOpenChange={setNavOpen} />
    </div>
  );
}
