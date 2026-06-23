'use client';
import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import ReaderNav from './ReaderNav';
import SurahNavPanel from './SurahNavPanel';
import MobileSurahDrawer from './MobileSurahDrawer';

const FALLBACK_NAV_HEIGHT = 72;

export default function ReaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const pageNum = (() => {
    const qp = parseInt(searchParams.get('page') ?? '', 10);
    if (!isNaN(qp) && qp > 0) return qp;
    const match = pathname.match(/\/reader\/(\d+)|\/share\/[^/]+\/(\d+)/);
    if (match) return parseInt(match[1] || match[2], 10);
    return 1;
  })();

  const navRef = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(FALLBACK_NAV_HEIGHT);

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
    <div style={{ background: 'var(--bg-base)' }}>
      <div ref={navRef}>
        <ReaderNav currentPage={pageNum} />
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <div
          className="hidden lg:block flex-shrink-0"
          style={{
            position: 'sticky',
            top: `${navHeight}px`,
            height: `calc(100vh - ${navHeight}px)`,
            width: '288px',
            overflowY: 'auto',
          }}
        >
          <SurahNavPanel topOffset={navHeight} />
        </div>
        <div style={{ flex: 1, minWidth: 0, minHeight: `calc(100vh - ${navHeight}px)` }}>
          {children}
          <footer
            className="w-full text-center text-xs tracking-wider uppercase border-t"
            style={{ padding: '10px 0', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
          >
            HifthCompanion © 2026
          </footer>
        </div>
      </div>
      <MobileSurahDrawer />
    </div>
  );
}
