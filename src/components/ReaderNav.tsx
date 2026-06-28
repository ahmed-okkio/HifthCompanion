'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { TOTAL_PAGES, clampPage } from '@/lib/quran';
import ProfileMenu from './ProfileMenu';
import Link from 'next/link';
import styles from './ReaderNav.module.css';

export default function ReaderNav({
  currentPage,
  onOpenSurah,
  onOpenNav,
  account,
}: {
  currentPage: number;
  onOpenSurah?: () => void;
  onOpenNav?: () => void;
  /** Signed-in user's chrome summary, or null when logged out. */
  account?: { name: string; email: string } | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jumpInput, setJumpInput] = useState('');
  const [jumpFocused, setJumpFocused] = useState(false);

  const go = (page: number) => {
    const clamped = clampPage(page);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    const qs = params.toString();
    router.push(`/reader/${clamped}${qs ? `?${qs}` : ''}`, { scroll: false });
    setJumpInput('');
  };

  return (
    <nav
      className={styles.navbar}
    >
      <div className={styles.inner}>

        <div className={styles.left}>
          {onOpenNav && (
            <button
              type="button"
              onClick={onOpenNav}
              aria-label="Open navigation"
              className="lg:hidden inline-flex items-center justify-center"
              style={{ width: 40, height: 40, marginInlineStart: -6, marginInlineEnd: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          )}
          <Link href="/reader/1" className={styles.brand}>
            <span className={styles.brandIcon}>
              {/* Plain <img> from /public — bypasses next/image optimizer (it was
                  failing to render the logo on Vercel). */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/logo.png"
                alt="Hifth Companion logo"
                style={{ height: '80%', width: 'auto', objectFit: 'contain' }}
              />
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandTitle}>Hifth Companion</span>
            </span>
          </Link>

        </div>

        <div className={styles.navigator}>
          {onOpenSurah && (
            <button
              type="button"
              onClick={onOpenSurah}
              title="Open surah list"
              aria-label="Open surah list"
              className={styles.surahButton}
            >
              {/* Bug 2 fix: explicit width/height prevents FOUC at intrinsic size */}
              <svg width="16" height="16" className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <line x1="8" y1="6" x2="21" y2="6" />
                <line x1="8" y1="12" x2="21" y2="12" />
                <line x1="8" y1="18" x2="21" y2="18" />
                <line x1="3" y1="6" x2="3.01" y2="6" />
                <line x1="3" y1="12" x2="3.01" y2="12" />
                <line x1="3" y1="18" x2="3.01" y2="18" />
              </svg>
            </button>
          )}
          <button
            onClick={() => go(currentPage - 1)}
            disabled={currentPage === 1}
            suppressHydrationWarning
            title="Previous page"
            className={styles.navButton}
          >
            <svg width="16" height="16" className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
            <svg width="16" height="16" className={styles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className={styles.actions}>
          {account ? (
            <ProfileMenu name={account.name} email={account.email} />
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
