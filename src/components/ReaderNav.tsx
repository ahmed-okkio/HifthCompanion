'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { TOTAL_PAGES, clampPage, spreadUrl, spreadOf } from '@/lib/quran';
import ProfileMenu from './ProfileMenu';
import Brand from './Brand';
import Link from 'next/link';
import styles from './ReaderNav.module.css';
import { useI18n } from './I18nProvider';

export default function ReaderNav({
  currentPage,
  onOpenSurah,
  onOpenNav,
  account,
  sharePageBasePath,
  isSpread = false,
}: {
  currentPage: number;
  onOpenSurah?: () => void;
  onOpenNav?: () => void;
  /** Signed-in user's chrome summary, or null when logged out. */
  account?: { name: string; email: string } | null;
  /** When set (e.g. `/share/{setId}`), page prev/next/jump links are built as
      `${base}/${n}` instead of `/reader/${n}` — used by the collaborator share view. */
  sharePageBasePath?: string;
  /** M6: when true, prev/next step by 2 and jumps snap to spread URL (D1-D4). */
  isSpread?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, fmtNum, locale } = useI18n();

  // Spread label follows reading direction: RTL (ar) shows high-low so the page
  // on the right reads first. LTR keeps low-high. URL (spreadUrl) is always low-high.
  const spreadLabel = (page: number) => {
    const [low, high] = spreadOf(page);
    const [a, b] = locale === 'ar' ? [high, low] : [low, high];
    return `${fmtNum(a)}-${fmtNum(b)}`;
  };
  const [jumpInput, setJumpInput] = useState('');
  const [jumpFocused, setJumpFocused] = useState(false);

  const go = (page: number) => {
    const clamped = clampPage(page);
    const target = isSpread ? spreadUrl(clamped) : String(clamped);
    if (sharePageBasePath) {
      router.push(`${sharePageBasePath}/${target}`, { scroll: false });
      setJumpInput('');
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    const qs = params.toString();
    router.push(`/reader/${target}${qs ? `?${qs}` : ''}`, { scroll: false });
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
              aria-label={t('nav.openNavigation')}
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
          {/* When the mobile drawer is wired (onOpenNav), the brand lives there;
              show it in the bar only ≥lg. Share view has no drawer → keep it. */}
          {onOpenNav ? <span className="hidden lg:flex min-w-0"><Brand /></span> : <Brand />}

        </div>

        <div className={styles.navigator}>
          {onOpenSurah && (
            <button
              type="button"
              onClick={onOpenSurah}
              title={t('share.openSurahList')}
              aria-label={t('share.openSurahList')}
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
          <div className={styles.pageShell}>
            <span className={styles.pageLabel}>{t('home.page')}</span>
            {jumpFocused ? (
              <input
                type="number"
                min={1}
                max={TOTAL_PAGES}
                value={jumpInput}
                autoFocus
                onChange={e => setJumpInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { go(parseInt(jumpInput, 10)); setJumpFocused(false); setJumpInput(''); }
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
              <span
                onClick={() => setJumpFocused(true)}
                title={t('reader.clickToJumpPage')}
                className={styles.pageCurrent}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') setJumpFocused(true); }}
              >
                {isSpread ? spreadLabel(currentPage) : fmtNum(currentPage)}
              </span>
            )}
            <span className={styles.pageDivider}>/</span>
            <span className={styles.pageTotal}>{fmtNum(TOTAL_PAGES)}</span>
          </div>
        </div>

        <div className={styles.actions}>
          {account ? (
            <ProfileMenu name={account.name} email={account.email} />
          ) : (
            <Link
              href="/login"
              className={styles.loginButton}
            >
              {t('share.logIn')}
            </Link>
          )}
        </div>

      </div>
    </nav>
  );
}
