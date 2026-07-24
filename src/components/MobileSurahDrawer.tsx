'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { activeGroupPage, filterSurahGroups, getSurahName, pageFromLocation, spreadUrl, type SurahPageGroup } from '@/lib/quran';
import { pinStorageKey } from '@/lib/bookmark';
import { useI18n } from '@/components/I18nProvider';

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

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

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

  const handleSelect = async (group: SurahPageGroup) => {
    const flush = (window as Window & { __hifthFlushReaderCanvas?: () => Promise<void> }).__hifthFlushReaderCanvas;
    await flush?.();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    const query = params.toString();
    const pageSeg = isSpread ? spreadUrl(group.page) : String(group.page);
    const targetPath = `${basePath}/${pageSeg}`;
    const targetHref = query ? `${targetPath}?${query}` : targetPath;
    onOpenChange(false);
    if (currentPage !== group.page) {
      router.push(targetHref, { scroll: false });
    }
  };

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          onClick={() => onOpenChange(false)}
          aria-hidden
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 49,
            background: 'rgba(0,0,0,0.4)',
          }}
        />
      )}

      {/* Bottom sheet — V3 Story 16: white surface (--surface-main), token radius, e3 shadow */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('reader.surahNavigation')}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: '85vh',
          background: 'var(--surface-main)',
          borderTopLeftRadius: 'var(--radius-xl)',   /* 20px token */
          borderTopRightRadius: 'var(--radius-xl)',
          boxShadow: 'var(--shadow-e3)',
          flexDirection: 'column',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 0.3s cubic-bezier(0.32, 0.72, 0, 1)',
          willChange: 'transform',
        }}
        className="lg:hidden flex"
      >
        {/* Drag handle */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            paddingTop: '12px',
            paddingBottom: '4px',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '36px',
              height: '4px',
              borderRadius: 'var(--radius-full)',   /* pill — drag handle only */
              background: 'var(--neutral-300)',
            }}
          />
        </div>

        {/* Header */}
        <div style={{ padding: 'var(--space-8) var(--space-12) var(--space-12)', flexShrink: 0 }}>
          <div
            style={{
              borderRadius: 'var(--radius-lg)',  /* 18px token */
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-app)',     /* neutral app bg inside drawer header */
              padding: 'var(--space-12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-12)' }}>
              <span style={{ fontSize: 'var(--type-heading-m-size)', fontWeight: 'var(--type-heading-m-weight)' as React.CSSProperties['fontWeight'], color: 'var(--text-primary)' }}>
                {t('reader.surahs')}
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label={t('reader.closeSurahList')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-sm)',   /* 10px token */
                  background: 'var(--surface-main)',
                  border: '1px solid var(--border-subtle)',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div style={{ position: 'relative' }}>
              <svg
                style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', width: '18px', height: '18px', color: 'var(--text-muted)', pointerEvents: 'none' }}
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
                className="input input-sm w-full"
                aria-label={t('reader.searchSurah')}
                style={{ background: 'transparent', paddingLeft: '2.75rem' }}
              />
            </div>
          </div>
          <p style={{ margin: '8px 4px 0', fontSize: 'var(--type-caption-size)', color: 'var(--text-muted)' }}>
            {t('reader.holdToBookmark')}
          </p>
        </div>

        {/* Scrollable list */}
        <div
          data-testid="mobile-surah-scroll-list"
          className="thin-scroll"
          style={{ flex: 1, overflowY: 'auto', padding: '0 8px 32px' }}
        >
          <ul style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {filtered.map(group => {
              const active = activePage === group.page;
              const isMultiSurah = group.surahs.length > 1;
              return (
                <li key={group.page} style={{ padding: '2px 8px' }}>
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
                    style={{
                      width: '100%',
                      /* V3 Story 16: token radius + token colors */
                      borderRadius: 'var(--radius-lg)',    /* 18px */
                      padding: isMultiSurah ? '14px 12px' : '10px 12px',
                      textAlign: 'left',
                      border: active ? '1px solid var(--border-accent)' : '1px solid transparent',
                      background: active ? 'var(--green-soft)' : 'var(--surface-main)',
                      cursor: 'pointer',
                      transition: 'all var(--duration-fast) var(--ease-out)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: isMultiSurah ? 'column' : 'row', gap: isMultiSurah ? 'var(--space-8)' : '0' }}>
                      {group.surahs.map(n => (
                        <div key={n} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '28px',
                              height: '28px',
                              borderRadius: 'var(--radius-sm)',  /* 10px token */
                              padding: '0 6px',
                              fontSize: 'var(--type-caption-size)',  /* 12px */
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                              boxShadow: 'var(--shadow-e1)',
                              background: active ? 'var(--surface-main)' : 'var(--green-soft)',
                              color: 'var(--green-600)',
                              outline: '1px solid var(--border-accent)',
                              flexShrink: 0,
                            }}
                          >
                            {fmtNum(n)}
                          </span>
                          <span
                            style={{
                              fontSize: 'var(--type-body-size)',  /* 14px */
                              fontWeight: 600,
                              lineHeight: 1.3,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              color: active ? 'var(--text-accent)' : 'var(--text-primary)',
                            }}
                          >
                            {getSurahName(n, locale)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div
                      style={{
                        marginTop: 'var(--space-4)',
                        paddingLeft: '40px',
                        fontSize: 'var(--type-caption-size)',  /* 12px */
                        fontWeight: 500,
                        color: active ? 'var(--text-accent)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      {t('reader.pageNum', { n: group.page })}{group.surahs.length > 1 ? ` · ${t('reader.surahsCount', { count: group.surahs.length })}` : ''}
                      {bookmarkedPage === group.page && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: 'var(--green-600)', fontWeight: 700 }}>
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
