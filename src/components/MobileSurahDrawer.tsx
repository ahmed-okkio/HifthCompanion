'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SURAH_FIRST_PAGES, spreadUrl } from '@/lib/quran';

type Surah = {
  number: number;
  name: string;
};

type SurahPageGroup = {
  page: number;
  surahs: Surah[];
};

const SURAH_LIST: Surah[] = [
  { number: 1, name: 'Al-Fatihah' },
  { number: 2, name: 'Al-Baqarah' },
  { number: 3, name: 'Aal-i-Imran' },
  { number: 4, name: "An-Nisa'" },
  { number: 5, name: "Al-Ma'idah" },
  { number: 6, name: "Al-An'am" },
  { number: 7, name: "Al-A'raf" },
  { number: 8, name: 'Al-Anfal' },
  { number: 9, name: 'At-Tawbah' },
  { number: 10, name: 'Yunus' },
  { number: 11, name: 'Hud' },
  { number: 12, name: 'Yusuf' },
  { number: 13, name: "Ar-Ra'd" },
  { number: 14, name: 'Ibrahim' },
  { number: 15, name: 'Al-Hijr' },
  { number: 16, name: 'An-Nahl' },
  { number: 17, name: "Al-Isra'" },
  { number: 18, name: 'Al-Kahf' },
  { number: 19, name: 'Maryam' },
  { number: 20, name: 'Ta-Ha' },
  { number: 21, name: 'Al-Anbiya' },
  { number: 22, name: 'Al-Hajj' },
  { number: 23, name: "Al-Mu'minun" },
  { number: 24, name: 'An-Nur' },
  { number: 25, name: 'Al-Furqan' },
  { number: 26, name: "Ash-Shu'ara'" },
  { number: 27, name: 'An-Naml' },
  { number: 28, name: 'Al-Qasas' },
  { number: 29, name: 'Al-Ankabut' },
  { number: 30, name: 'Ar-Rum' },
  { number: 31, name: 'Luqman' },
  { number: 32, name: 'As-Sajdah' },
  { number: 33, name: 'Al-Ahzab' },
  { number: 34, name: 'Saba' },
  { number: 35, name: 'Fatir' },
  { number: 36, name: 'Ya-Sin' },
  { number: 37, name: 'As-Saffat' },
  { number: 38, name: 'Sad' },
  { number: 39, name: 'Az-Zumar' },
  { number: 40, name: 'Ghafir' },
  { number: 41, name: 'Fussilat' },
  { number: 42, name: 'Ash-Shura' },
  { number: 43, name: 'Az-Zukhruf' },
  { number: 44, name: 'Ad-Dukhan' },
  { number: 45, name: 'Al-Jathiyah' },
  { number: 46, name: 'Al-Ahqaf' },
  { number: 47, name: 'Muhammad' },
  { number: 48, name: 'Al-Fath' },
  { number: 49, name: 'Al-Hujurat' },
  { number: 50, name: 'Qaf' },
  { number: 51, name: 'Adh-Dhariyat' },
  { number: 52, name: 'At-Tur' },
  { number: 53, name: 'An-Najm' },
  { number: 54, name: 'Al-Qamar' },
  { number: 55, name: 'Ar-Rahman' },
  { number: 56, name: "Al-Waqi'" },
  { number: 57, name: 'Al-Hadid' },
  { number: 58, name: 'Al-Mujadila' },
  { number: 59, name: 'Al-Hashr' },
  { number: 60, name: 'Al-Mumtahanah' },
  { number: 61, name: 'As-Saff' },
  { number: 62, name: "Al-Jumu'ah" },
  { number: 63, name: 'Al-Munafiqun' },
  { number: 64, name: 'At-Taghabun' },
  { number: 65, name: 'At-Talaq' },
  { number: 66, name: 'At-Tahrim' },
  { number: 67, name: 'Al-Mulk' },
  { number: 68, name: 'Al-Qalam' },
  { number: 69, name: 'Al-Haqqah' },
  { number: 70, name: "Al-Ma'arij" },
  { number: 71, name: 'Nuh' },
  { number: 72, name: 'Al-Jinn' },
  { number: 73, name: 'Al-Muzzammil' },
  { number: 74, name: 'Al-Muddathir' },
  { number: 75, name: 'Al-Qiyamah' },
  { number: 76, name: 'Al-Insan' },
  { number: 77, name: 'Al-Mursalat' },
  { number: 78, name: "An-Naba'" },
  { number: 79, name: "An-Nazi'at" },
  { number: 80, name: 'Abasa' },
  { number: 81, name: 'At-Takwir' },
  { number: 82, name: 'Al-Infitar' },
  { number: 83, name: 'Al-Mutaffifin' },
  { number: 84, name: 'Al-Inshiqaq' },
  { number: 85, name: 'Al-Buruj' },
  { number: 86, name: 'At-Tariq' },
  { number: 87, name: 'Al-Ala' },
  { number: 88, name: 'Al-Ghashiyah' },
  { number: 89, name: 'Al-Fajr' },
  { number: 90, name: 'Al-Balad' },
  { number: 91, name: 'Ash-Shams' },
  { number: 92, name: 'Al-Layl' },
  { number: 93, name: 'Ad-Duha' },
  { number: 94, name: 'Ash-Sharh' },
  { number: 95, name: 'At-Tin' },
  { number: 96, name: 'Al-Alaq' },
  { number: 97, name: 'Al-Qadr' },
  { number: 98, name: 'Al-Bayyinah' },
  { number: 99, name: 'Az-Zalzalah' },
  { number: 100, name: 'Al-Adiyat' },
  { number: 101, name: "Al-Qari'ah" },
  { number: 102, name: 'At-Takathur' },
  { number: 103, name: 'Al-Asr' },
  { number: 104, name: 'Al-Humazah' },
  { number: 105, name: 'Al-Fil' },
  { number: 106, name: 'Quraysh' },
  { number: 107, name: 'Al-Maun' },
  { number: 108, name: 'Al-Kawthar' },
  { number: 109, name: 'Al-Kafirun' },
  { number: 110, name: 'An-Nasr' },
  { number: 111, name: 'Al-Masad' },
  { number: 112, name: 'Al-Ikhlas' },
  { number: 113, name: 'Al-Falaq' },
  { number: 114, name: 'An-Nas' },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  basePath?: string;
  /** M6: when true, surah jumps target the spread URL containing the page (D3). */
  isSpread?: boolean;
}

export default function MobileSurahDrawer({ open, onOpenChange, basePath = '/reader', isSpread = false }: Props) {
  const [query, setQuery] = useState('');
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasAutoScrolledRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = useMemo(() => {
    const qp = parseInt(searchParams.get('page') ?? '', 10);
    if (!isNaN(qp) && qp > 0) return qp;
    const readerMatch = pathname.match(/^\/reader\/(\d+)/);
    if (readerMatch) return parseInt(readerMatch[1], 10);
    const shareMatch = pathname.match(/^\/share\/[^/]+\/(\d+)/);
    if (shareMatch) return parseInt(shareMatch[1], 10);
    return 1;
  }, [pathname, searchParams]);

  const groupedSurahs = useMemo<SurahPageGroup[]>(() => {
    const groups = new Map<number, Surah[]>();
    SURAH_LIST.forEach(surah => {
      const page = SURAH_FIRST_PAGES[surah.number];
      if (!groups.has(page)) groups.set(page, []);
      groups.get(page)!.push(surah);
    });
    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([page, groupSurahs]) => ({ page, surahs: groupSurahs }));
  }, []);

  const activePage = useMemo(() => {
    let page = SURAH_FIRST_PAGES[1] ?? 1;
    for (const group of groupedSurahs) {
      if (group.page <= currentPage) page = group.page;
      else break;
    }
    return page;
  }, [currentPage, groupedSurahs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groupedSurahs;
    return groupedSurahs.filter(group =>
      `${group.page}`.includes(q) ||
      group.surahs.some(
        surah =>
          `${surah.number}`.includes(q) ||
          surah.name.toLowerCase().includes(q),
      ),
    );
  }, [groupedSurahs, query]);

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
        aria-label="Surah navigation"
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          height: '85vh',
          background: 'var(--surface-main)',
          borderTopLeftRadius: 'var(--radius-max)',   /* 20px token */
          borderTopRightRadius: 'var(--radius-max)',
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
              borderRadius: 'var(--radius-lg-px)',  /* 18px token */
              border: '1px solid var(--border-subtle)',
              background: 'var(--surface-app)',     /* neutral app bg inside drawer header */
              padding: 'var(--space-12)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-12)' }}>
              <span style={{ fontSize: 'var(--type-heading-m-size)', fontWeight: 'var(--type-heading-m-weight)' as React.CSSProperties['fontWeight'], color: 'var(--text-primary)' }}>
                Surahs
              </span>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close surah list"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '28px',
                  height: '28px',
                  borderRadius: 'var(--radius-sm-px)',   /* 10px token */
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
                placeholder="Search surah"
                className="input input-sm w-full"
                aria-label="Search surah"
                style={{ background: 'transparent', paddingLeft: '2.75rem' }}
              />
            </div>
          </div>
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
                    onClick={() => { void handleSelect(group); }}
                    style={{
                      width: '100%',
                      /* V3 Story 16: token radius + token colors */
                      borderRadius: 'var(--radius-lg-px)',    /* 18px */
                      padding: isMultiSurah ? '14px 12px' : '10px 12px',
                      textAlign: 'left',
                      border: active ? '1px solid var(--border-accent)' : '1px solid transparent',
                      background: active ? 'var(--green-soft)' : 'var(--surface-main)',
                      cursor: 'pointer',
                      transition: 'all var(--duration-fast) var(--ease-out)',
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: isMultiSurah ? 'column' : 'row', gap: isMultiSurah ? 'var(--space-8)' : '0' }}>
                      {group.surahs.map(surah => (
                        <div key={surah.number} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-12)' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: '28px',
                              height: '28px',
                              borderRadius: 'var(--radius-sm-px)',  /* 10px token */
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
                            {surah.number}
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
                            {surah.name}
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
                      }}
                    >
                      Page {group.page}{group.surahs.length > 1 ? ` · ${group.surahs.length} surahs` : ''}
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
