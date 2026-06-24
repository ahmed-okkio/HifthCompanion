'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import { TOTAL_PAGES, clampPage, getSurahForPage } from '@/lib/quran';
import { SURAH_LIST } from './SurahNavPanel';
import LogoutButton from './LogoutButton';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import styles from './ReaderNav.module.css';

export default function ReaderNav({ currentPage, onOpenSurah }: { currentPage: number; onOpenSurah?: () => void }) {
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
          <Link href="/reader/1" className={styles.brand}>
            <span className={styles.brandIcon}>
              {/* Bug 1 fix: outline book, stroke green-600 (color: var(--green-600) from CSS).
                  No filled green background — that lives only in the NavRail LogoBlock.
                  Bug 2 fix: explicit width/height so SVG never renders at intrinsic size. */}
              <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
              </svg>
            </span>
            <span className={styles.brandText}>
              <span className={styles.brandTitle}>Hifth Companion</span>
            </span>
          </Link>

          {/*
            Story 7 (Sonnet) — "Juz — › Surah" breadcrumb.
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

          {/* Theme toggle — icon button, desktop only.
              INERT PLACEHOLDER: dark mode not implemented (PRD 0002, out of scope).
              Shows sun icon. No onClick. aria-disabled prevents assistive interaction.
              data-placeholder="theme" marks it as a future affordance. */}
          <button
            type="button"
            tabIndex={-1}
            aria-disabled="true"
            data-placeholder="theme"
            className={`${styles.themeStub} hide-mobile`}
            title="Theme (coming soon)"
          >
            {/* Sun icon — represents light/dark toggle affordance */}
            {/* Bug 2 fix: explicit width/height on theme toggle sun icon */}
            <svg width="17" height="17" className={styles.actionIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="4" strokeWidth={2} />
              <path strokeLinecap="round" strokeWidth={2} d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
            </svg>
          </button>

          {isLoggedIn === null ? (
            <div className={styles.skeleton} />
          ) : isLoggedIn ? (
            <>
              <Link
                href="/sets"
                className={`${styles.secondaryAction} hide-mobile`}
              >
                {/* Bug 2 fix: explicit width/height on My Sets icon */}
                <svg width="17" height="17" className={styles.actionIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
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
