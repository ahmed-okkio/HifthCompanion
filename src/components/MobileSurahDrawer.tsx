'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { activeGroupPage, filterSurahGroups, getSurahName, pageFromLocation, type SurahPageGroup } from '@/lib/quran';
import { pinStorageKey } from '@/lib/bookmark';
import { useI18n } from '@/components/I18nProvider';
import { useGoToPage } from '@/hooks/useGoToPage';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basePath?: string;
  /** M6: when true, surah jumps target the spread URL containing the page (D3). */
  isSpread?: boolean;
}

export default function MobileSurahDrawer({ open, onOpenChange, basePath = '/reader', isSpread = false }: Props) {
  const { t, locale, fmtNum } = useI18n();
  const [query, setQuery] = useState('');
  const [bookmarkedPage, setBookmarkedPage] = useState<number | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClickRef = useRef(false);

  const BOOKMARK_KEY = pinStorageKey(basePath);

  useEffect(() => {
    const raw = localStorage.getItem(BOOKMARK_KEY);
    const n = raw ? parseInt(raw, 10) : NaN;
    setBookmarkedPage(!isNaN(n) && n > 0 ? n : null);
  }, [BOOKMARK_KEY]);

  const toggleBookmark = (page: number) => {
    setBookmarkedPage(prev => {
      const next = prev === page ? null : page;
      if (next === null) localStorage.removeItem(BOOKMARK_KEY);
      else localStorage.setItem(BOOKMARK_KEY, String(next));
      return next;
    });
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(15);
  };

  const startLongPress = (page: number) => {
    suppressClickRef.current = false;
    longPressTimer.current = setTimeout(() => {
      suppressClickRef.current = true;
      toggleBookmark(page);
    }, 500);
  };
  const cancelLongPress = () => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
  };

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { goToPage } = useGoToPage({ basePath, isSpread });

  const currentPage = useMemo(() => pageFromLocation(pathname, searchParams), [pathname, searchParams]);
  const activePage = useMemo(() => activeGroupPage(currentPage), [currentPage]);
  const filtered = useMemo(() => filterSurahGroups(query), [query]);

  useEffect(() => {
    if (!open) return;
    hasAutoScrolledRef.current = false;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (query.trim()) return;
    if (hasAutoScrolledRef.current) return;
    if (!activeButtonRef.current) return;
    activeButtonRef.current.scrollIntoView({ block: 'center', inline: 'nearest' });
    hasAutoScrolledRef.current = true;
  }, [open, activePage, query]);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setTimeout(() => searchInputRef.current?.focus(), 150);
    } else {
      document.body.style.overflow = '';
      setQuery('');
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  const handleSelect = (group: SurahPageGroup) => {
    onOpenChange(false);
    void goToPage(group.page);
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={() => onOpenChange(false)}
          aria-hidden
          className="fixed inset-0 z-(--z-sticky) bg-overlay"
        />
      )}

      {/* Bottom sheet — V3 Story 16: white surface (--surface-main), token radius, e3 shadow */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('reader.surahNavigation')}
        className={`lg:hidden flex fixed bottom-0 left-0 right-0 z-50 h-[85vh] flex-col bg-surface-main rounded-t-xl shadow-e3 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform`}
        // eslint-disable-next-line shadcn/no-inline-styles -- open/closed state; e2e reads style.transform
        style={{ transform: open ? 'translateY(0)' : 'translateY(100%)' }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-9 h-1 rounded-full bg-neutral-300" />
        </div>

        {/* Header */}
        <div className="px-3 pt-2 pb-3 shrink-0">
          <div className="rounded-lg border border-subtle bg-surface-app p-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-heading-m text-primary">
                {t('reader.surahs')}
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label={t('reader.closeSurahList')}
                className="btn btn-ghost btn-icon btn-sm"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="relative">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4.5 text-muted pointer-events-none"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
                <circle cx="11" cy="11" r="6" strokeWidth={2} />
              </svg>
              <input
                ref={searchInputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={t('reader.searchSurah')}
                className="input input-sm w-full bg-transparent pl-11"
                aria-label={t('reader.searchSurah')}
              />
            </div>
          </div>
          <p className="mt-2 mx-1 mb-0 text-caption text-muted">
            {t('reader.holdToBookmark')}
          </p>
        </div>

        {/* Scrollable list */}
        <div
          data-testid="mobile-surah-scroll-list"
          className="thin-scroll flex-1 overflow-y-auto px-2 pb-8"
        >
          <ul className="flex flex-col gap-1">
            {filtered.map(group => {
              const active = activePage === group.page;
              const isMultiSurah = group.surahs.length > 1;
              return (
                <li key={group.page} className="px-2 py-0.5">
                  <button
                    ref={active ? activeButtonRef : undefined}
                    type="button"
                    onClick={() => {
                      if (suppressClickRef.current) { suppressClickRef.current = false; return; }
                      void handleSelect(group);
                    }}
                    onPointerDown={() => startLongPress(group.page)}
                    onPointerUp={cancelLongPress}
                    onPointerLeave={cancelLongPress}
                    onPointerCancel={cancelLongPress}
                    onContextMenu={e => e.preventDefault()}
                    className={`w-full rounded-lg px-3 text-left border cursor-pointer transition-all duration-(--duration-fast) ease-(--ease-out) ${isMultiSurah ? 'py-3.5' : 'py-2.5'} ${
                      active ? 'border-(--border-accent) bg-accent-muted' : 'border-transparent bg-surface-main'
                    }`}
                  >
                    <div className={`flex ${isMultiSurah ? 'flex-col gap-2' : 'flex-row gap-0'}`}>
                      {group.surahs.map(n => (
                        <div key={n} className="flex items-center gap-3">
                          <span
                            className={`inline-flex items-center justify-center min-w-7 h-7 rounded-sm px-1.5 text-caption font-bold tabular-nums shadow-e1 text-green-600 outline outline-(--border-accent) shrink-0 ${active ? 'bg-surface-main' : 'bg-green-soft'}`}
                          >
                            {fmtNum(n)}
                          </span>
                          <span
                            className={`text-body font-semibold leading-[1.3] truncate ${active ? 'text-(--text-accent)' : 'text-primary'}`}
                          >
                            {getSurahName(n, locale)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div
                      className={`mt-1 pl-10 text-caption font-medium flex items-center gap-1.5 ${active ? 'text-(--text-accent)' : 'text-muted'}`}
                    >
                      {t('reader.pageNum', { n: group.page })}{group.surahs.length > 1 ? ` · ${t('reader.surahsCount', { count: group.surahs.length })}` : ''}
                      {bookmarkedPage === group.page && (
                        <span className="inline-flex items-center gap-0.75 text-green-600 font-bold">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 3h12a1 1 0 0 1 1 1v17l-7-4.2L5 21V4a1 1 0 0 1 1-1z" />
                          </svg>
                          {t('reader.default')}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
