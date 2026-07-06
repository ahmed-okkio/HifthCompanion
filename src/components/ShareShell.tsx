'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { TOTAL_PAGES, clampPage } from '@/lib/quran';
import SurahNavPanel from './SurahNavPanel';
import MobileSurahDrawer from './MobileSurahDrawer';
import MobileNavDrawer from './MobileNavDrawer';
import NavRail from './NavRail';
import ProfileMenu from './ProfileMenu';
import shareStyles from './ShareShell.module.css';
import navStyles from './ReaderNav.module.css';
import { useI18n } from '@/components/I18nProvider';

const FALLBACK_NAV_HEIGHT = 56;

interface Props {
  /** Canonical share base, e.g. `/share/{setId}`. Drives page + surah nav links. */
  basePath: string;
  pageNum: number;
  setName: string;
  /** Set owner's display name — primary header text (S1). Absent for guest/E2E → set-name-only (S2). */
  ownerName?: string;
  children: React.ReactNode;
  /** Signed-in visitor's chrome summary, or null for a guest viewer. */
  account?: { name: string; email: string } | null;
}

/**
 * Share view shell — mirrors ReaderShell's layout (Story 14): a 100dvh flex
 * column with the share header at the top, a left surah panel that scrolls
 * internally on desktop, and a centered read-only page. On mobile the header is
 * fixed chrome and the content scrolls beneath it, with the surah list living in
 * the bottom-sheet (opened from the header). Read-only throughout — no annotation
 * toolbar, so there is no fixed bottom bar to pad against.
 */
export default function ShareShell({ basePath, pageNum, setName, ownerName, children, account = null }: Props) {
  const { t } = useI18n();
  const navRef = useRef<HTMLDivElement>(null);
  const [navHeight, setNavHeight] = useState(FALLBACK_NAV_HEIGHT);
  const [surahOpen, setSurahOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);

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

  const prevPage = clampPage(pageNum - 1);
  const nextPage = clampPage(pageNum + 1);

  return (
    <div
      className="lg:h-[100dvh] lg:flex lg:flex-col lg:overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* On mobile the header is position:fixed (see ShareShell.module.css); on
          desktop it sits in-flow at the top of the flex column. */}
      <div ref={navRef} className={`${shareStyles.headerWrap} lg:flex-shrink-0`}>
        {/* V3 — read-only header mirrors ReaderNav (brand left, centered page navigator pill,
            actions right) using the same ReaderNav.module.css so the style matches the reader. */}
        <header
          className="w-full"
          style={{ background: 'var(--surface-main)', borderBottom: '1px solid var(--border-subtle)', borderRadius: 0, boxShadow: 'var(--shadow-e1)' }}
        >
          <div className={navStyles.inner}>

            <div className={navStyles.left}>
              <button
                type="button"
                onClick={() => setNavOpen(true)}
                aria-label={t('share.openNavigation')}
                className="lg:hidden inline-flex items-center justify-center"
                style={{ width: 40, height: 40, marginInlineStart: -6, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-secondary)' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setSurahOpen(true)}
                title={t('share.openSurahList')}
                aria-label={t('share.openSurahList')}
                className={navStyles.surahButton}
              >
                <svg width="16" height="16" className={navStyles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
              <Link href="/reader" className={navStyles.brand}>
                <span className={navStyles.brandIcon}>
                  <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
                    <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} />
                  </svg>
                </span>
                <span className={navStyles.brandText}>
                  <span className={navStyles.brandTitle}>Hifth Companion</span>
                </span>
              </Link>
              <span className={navStyles.contextBreadcrumb}>
                {ownerName ? (
                  <>
                    {/* S1 — owner primary, set name as subtext. */}
                    <span className={navStyles.contextSurah}>{ownerName}</span>
                    <span className={navStyles.contextSep} aria-hidden>·</span>
                    <span className={navStyles.contextJuz}>{setName}</span>
                  </>
                ) : (
                  <>
                    {/* S2 — guest/unresolvable owner: set name alone. */}
                    <span className={navStyles.contextSurah}>{setName}</span>
                    <span className={navStyles.contextSep} aria-hidden>·</span>
                    <span className={navStyles.contextJuz}>{t('share.readOnly')}</span>
                  </>
                )}
              </span>
            </div>

            <div className={navStyles.navigator}>
              <Link
                href={`${basePath}/${nextPage}`}
                title={t('share.nextPage')}
                aria-disabled={pageNum === TOTAL_PAGES}
                className={navStyles.navButton}
                style={pageNum === TOTAL_PAGES ? { pointerEvents: 'none', opacity: 0.35 } : undefined}
              >
                <svg width="16" height="16" className={navStyles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>

              <div className={navStyles.pageShell}>
                <span className={navStyles.pageButton} style={{ cursor: 'default' }}>
                  <span className={navStyles.pageCurrent}>{pageNum}</span>
                  <span className={navStyles.pageDivider}>/</span>
                  <span className={navStyles.pageTotal}>{TOTAL_PAGES}</span>
                </span>
              </div>

              <Link
                href={`${basePath}/${prevPage}`}
                title={t('share.previousPage')}
                aria-disabled={pageNum === 1}
                className={navStyles.navButton}
                style={pageNum === 1 ? { pointerEvents: 'none', opacity: 0.35 } : undefined}
              >
                <svg width="16" height="16" className={navStyles.navIcon} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>

            <div className={navStyles.actions}>
              {account ? (
                <ProfileMenu name={account.name} email={account.email} />
              ) : (
                <Link href="/login" className={navStyles.loginButton}>
                  {t('share.logIn')}
                </Link>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* Content row: fills the remaining height on desktop. On mobile the nav is
          position:fixed, so --nav-h drives the padding-top via mobile-nav-offset. */}
      <div
        className="lg:flex-1 lg:min-h-0 mobile-nav-offset"
        style={{ display: 'flex', alignItems: 'flex-start', ['--nav-h' as string]: `${navHeight}px` } as React.CSSProperties}
        suppressHydrationWarning
      >
        <div className="hidden lg:block flex-shrink-0" style={{ width: '96px', height: '100%' }}>
          <NavRail />
        </div>
        <div
          className="hidden lg:flex lg:flex-col flex-shrink-0"
          style={{
            height: '100%',
            width: '320px',
            overflow: 'hidden',
          }}
        >
          <SurahNavPanel currentPage={pageNum} basePath={basePath} topOffset={navHeight} />
        </div>
        <div
          className="lg:h-full lg:min-h-0 lg:overflow-hidden lg:flex lg:flex-col"
          style={{ flex: 1, minWidth: 0 }}
        >
          {children}
        </div>
      </div>

      <MobileSurahDrawer open={surahOpen} onOpenChange={setSurahOpen} basePath={basePath} />
      <MobileNavDrawer open={navOpen} onOpenChange={setNavOpen} />
    </div>
  );
}
