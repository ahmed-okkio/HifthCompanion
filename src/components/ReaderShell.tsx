'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ReaderNav from './ReaderNav';
import SurahNavPanel from './SurahNavPanel';

function getPageFromPathname(pathname: string): number {
  const match = pathname.match(/^\/reader\/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 1;
}

// Fallback used only until the real navbar height is measured (and as a
// safety net if ResizeObserver is unavailable). Kept in sync with whatever
// ReaderNav.module.css currently renders at, but no longer load-bearing —
// navHeight below reflects the actual DOM height once mounted.
const FALLBACK_NAV_HEIGHT = 72;

export default function ReaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageNum = getPageFromPathname(pathname);
  const navRef = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(FALLBACK_NAV_HEIGHT);

  // Measure the navbar's real rendered height instead of assuming a fixed
  // 72px. SurahNavPanel positions itself with `top: ${topOffset}px` and
  // `height: calc(100vh - ${topOffset}px)` — if that number doesn't match
  // the navbar's actual height, the panel ends up clipped under (or with a
  // gap below) the navbar. A ResizeObserver keeps this correct even if the
  // navbar's height changes (responsive styles, font loading, etc).
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

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="hidden lg:block">
        <SurahNavPanel topOffset={navHeight} />
      </div>
      <div ref={navRef}>
        <ReaderNav currentPage={pageNum} />
      </div>
      <div className="flex min-w-0 flex-col" style={{ minHeight: `calc(100vh - ${navHeight}px)` }}>
        {children}
        <footer
          className="w-full py-6 text-center text-xs tracking-wider uppercase border-t"
          style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
        >
          HifthCompanion © 2026
        </footer>
      </div>
    </div>
  );
}