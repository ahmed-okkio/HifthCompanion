'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { TOTAL_PAGES, clampPage } from '@/lib/quran';
import LogoutButton from './LogoutButton';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import styles from './ReaderNav.module.css';

export default function ReaderNav({ currentPage }: { currentPage: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jumpInput, setJumpInput] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [jumpFocused, setJumpFocused] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then((res: any) => {
      setIsLoggedIn(!!res.data?.session);
    });
  }, []);

  const go = (page: number) => {
    const clamped = clampPage(page);
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(clamped));
    router.push(`/reader?${params.toString()}`, { scroll: false });
    setJumpInput('');
  };

  return (
    <nav
      className={styles.navbar}
    >
      <div className={styles.inner}>

        <Link href="/reader/1" className={styles.brand}>
          <svg className={styles.brandIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M12 5.5v12.25" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M12 6.25c-1.45-1.12-3.43-1.72-5.5-1.72-1.1 0-2.25.18-3.5.55v13.1c1.18-.41 2.33-.62 3.5-.62 2.07 0 4.05.62 5.5 1.8" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.9} d="M12 6.25c1.45-1.12 3.43-1.72 5.5-1.72 1.1 0 2.25.18 3.5.55v13.1c-1.18-.41-2.33-.62-3.5-.62-2.07 0-4.05.62-5.5 1.8" />
          </svg>
          <span className={styles.brandText}>
            <span className={styles.brandTitle}>Hifth Companion</span>
          </span>
        </Link>

        <div className={styles.navigator}>
          <button
            onClick={() => go(currentPage - 1)}
            disabled={currentPage === 1}
            suppressHydrationWarning
            title="Previous page"
            className={styles.navButton}
          >
            <svg className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className={styles.pageShell}>
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
                onBlur={() => {
                  setJumpFocused(false);
                  setJumpInput('');
                }}
                placeholder={String(currentPage)}
                className={styles.pageInput}
              />
            ) : (
              <button
                onClick={() => setJumpFocused(true)}
                title="Click to jump to page"
                className={styles.pageButton}
              >
                <span className={styles.pageCurrent}>{currentPage}</span>
                <span className={styles.pageDivider}>/</span>
                <span className={styles.pageTotal}>{TOTAL_PAGES}</span>
              </button>
            )}
          </div>

          <button
            onClick={() => go(currentPage + 1)}
            disabled={currentPage === TOTAL_PAGES}
            suppressHydrationWarning
            title="Next page"
            className={styles.navButton}
          >
            <svg className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className={styles.actions}>
          {isLoggedIn === null ? (
            <div className={styles.skeleton} />
          ) : isLoggedIn ? (
            <>
              <Link
                href="/sets"
                className={`${styles.secondaryAction} hide-mobile`}
              >
                <svg className={styles.actionIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span>My Sets</span>
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link
              href="/login"
              className={styles.loginButton}
            >
              Log In
            </Link>
          )}
        </div>

      </div>
    </nav>
  );
}
