'use client';

import { usePathname } from 'next/navigation';
import ReaderNav from './ReaderNav';
import SurahNavPanel from './SurahNavPanel';

function getPageFromPathname(pathname: string): number {
  const match = pathname.match(/^\/reader\/(\d+)/);
  return match ? Number.parseInt(match[1], 10) : 1;
}

export default function ReaderShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const pageNum = getPageFromPathname(pathname);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <div className="hidden lg:block">
        <SurahNavPanel />
      </div>
      <ReaderNav currentPage={pageNum} />
      <div className="flex min-h-[calc(100vh-72px)] min-w-0 flex-col">
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
