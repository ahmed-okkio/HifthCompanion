'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import Image from "next/image";
import logo from "@/app/assets/logo.png";
import { TOTAL_PAGES, clampPage, getSurahForPage } from '@/lib/quran';
import { SURAH_LIST } from './SurahNavPanel';
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
              className="lg:hidden"
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, marginInlineStart: -6, marginInlineEnd: 2, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
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
              <Image
                src={logo}
                alt="Hifth Companion logo"
                width={100}
                height={100}
                priority
              />
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandTitle}>Hifth Companion</span>
            </span>
          </Link>

          {/*
            Story 7 (Sonnet) — "Juz — › Surah" bread/...
            Juz part is a static placeholder ("Juz —"): no page→Juz mapping exists in src/lib.
            Surah name is derived live from currentPage via getSurahForPage + SURAH_LIST.
            Non-interactive label; aria-hidden keeps it out of the a11y tree.
          */}
          <div
            className={`${styles.contextSlot} hide-mobile`}
            data-testid="context-selector-slot"
            aria-hidden
          >
            {(() => {
              const surahNum = getSurahForPage(currentPage);
              const surahName = SURAH_LIST.find(s => s.number === surahNum)?.name ?? '';
              return (
                <span className={styles.contextBreadcrumb}>
                  <span className={styles.contextJuz}>Juz —</span>
                  <span className={styles.contextSep} aria-hidden>›</span>
                  <span className={styles.contextSurah}>{surahName}</span>
                </span>
              );
            })()}
          </div>
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
          {/*
            Story 8 (Sonnet) — Search affordance + Theme toggle.
            Both are INERT PLACEHOLDERS: no handlers, tabIndex={-1}, aria-disabled.
            Search is NOT wired to any search backend.
            Theme toggle does NOT implement dark mode (future feature, out of scope PRD 0002).
            Visually present, clearly non-functional; marked with data-placeholder attributes.
          */}

          {/* Search affordance — fake input field, desktop only.
              Rendered as a <div role="search"> wrapping a disabled <input> so screen readers
              understand its intent but it never accepts focus or submits anything.
              data-placeholder="search" + aria-disabled + tabIndex={-1} on all interactive children. */}
          <div
            role="search"
            aria-disabled="true"
            data-placeholder="search"
            className={`${styles.searchStub} hide-mobile`}
          >
            {/* Bug 2 fix: explicit width/height — prevents giant magnifier FOUC before CSS loads */}
            <svg width="14" height="14" className={styles.searchIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="11" cy="11" r="7" strokeWidth={2} />
              <path strokeLinecap="round" strokeWidth={2} d="M21 21l-4.3-4.3" />
            </svg>
            {/* disabled input — never focused, never submits */}
            <input
              type="search"
              disabled
              tabIndex={-1}
              placeholder="Search"
              aria-disabled="true"
              className={styles.searchInput}
            />
          </div>

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
