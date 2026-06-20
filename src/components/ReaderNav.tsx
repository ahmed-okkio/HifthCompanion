'use client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { TOTAL_PAGES, clampPage } from '@/lib/quran';
import LogoutButton from './LogoutButton';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function ReaderNav({ currentPage }: { currentPage: number }) {
  const router = useRouter();
  const [jumpInput, setJumpInput] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [jumpFocused, setJumpFocused] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then((res: any) => {
      setIsLoggedIn(!!res.data?.session);
    });
  }, [supabase]);

  const go = (page: number) => {
    const pageNum = clampPage(page);
    router.push(`/reader/${pageNum}`);
    setJumpInput('');
  };

  const progress = Math.round((currentPage / TOTAL_PAGES) * 100);

  return (
    <nav
      className="sticky top-0 z-50 w-full"
      style={{
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-[2px] transition-all duration-500"
        style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, var(--accent-solid), var(--accent))',
          boxShadow: '0 0 8px var(--accent-glow)',
        }}
      />

      <div className="mx-auto flex items-center justify-between px-4 h-14 max-w-5xl gap-3">

        {/* LEFT: Brand */}
        <Link href="/reader/1" className="flex items-center gap-2.5 shrink-0 group">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ color: 'var(--accent)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 20l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12V4" />
          </svg>
          <span className="flex flex-col">
            <span className="text-base font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
              حفظ
            </span>
            <span className="text-xs font-semibold hide-mobile" style={{ color: 'var(--accent)', fontWeight: 500 }}>
              HifthCompanion
            </span>
          </span>
        </Link>

        {/* CENTER: Navigation pill */}
        <div
          className="flex items-center gap-1 rounded-full px-1.5 py-1.5"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          {/* Prev */}
          <button
            onClick={() => go(currentPage - 1)}
            disabled={currentPage === 1}
            suppressHydrationWarning
            title="Previous page"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 disabled:opacity-30"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              if (currentPage !== 1) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          {/* Page display / jump input */}
          <div className="relative flex items-center">
            {jumpFocused ? (
              <input
                type="number"
                min={1}
                max={TOTAL_PAGES}
                value={jumpInput}
                autoFocus
                onChange={e => setJumpInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') go(parseInt(jumpInput, 10));
                  if (e.key === 'Escape') setJumpFocused(false);
                }}
                onBlur={() => { setJumpFocused(false); setJumpInput(''); }}
                placeholder={String(currentPage)}
                className="text-center text-sm font-semibold tabular-nums bg-transparent outline-none"
                style={{
                  width: '72px',
                  color: 'var(--text-accent)',
                  caretColor: 'var(--accent)',
                }}
              />
            ) : (
              <button
                onClick={() => setJumpFocused(true)}
                title="Click to jump to page"
                className="flex items-center gap-1 px-2 py-0.5 rounded-md text-sm tabular-nums transition-colors duration-150"
                style={{ color: 'var(--text-primary)', fontWeight: 600 }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <span className="font-bold" style={{ color: 'var(--text-accent)' }}>{currentPage}</span>
                <span style={{ color: 'var(--text-muted)' }}>/</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{TOTAL_PAGES}</span>
              </button>
            )}
          </div>

          {/* Next */}
          <button
            onClick={() => go(currentPage + 1)}
            disabled={currentPage === TOTAL_PAGES}
            suppressHydrationWarning
            title="Next page"
            className="w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 disabled:opacity-30"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={e => {
              if (currentPage !== TOTAL_PAGES) {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = 'transparent';
              (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)';
            }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* RIGHT: Auth */}
        <div className="flex items-center gap-2 shrink-0">
          {isLoggedIn === null ? (
            <div
              className="w-20 h-8 rounded-full animate-pulse"
              style={{ background: 'rgba(255,255,255,0.06)' }}
            />
          ) : isLoggedIn ? (
            <>
              <Link
                href="/sets"
                className="hide-mobile flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150"
                style={{ color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                }}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                My Sets
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-150"
              style={{
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-card-hover)';
                (e.currentTarget as HTMLElement).style.boxShadow = '0 0 8px var(--accent-glow)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-card)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              Log In
            </Link>
          )}
        </div>

      </div>
    </nav>
  );
}
