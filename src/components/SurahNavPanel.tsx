'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { SURAH_FIRST_PAGES } from '@/lib/quran';

export type Surah = {
  number: number;
  name: string;
  englishName?: string;
  verses?: number;
};

type SurahPageGroup = {
  page: number;
  surahs: Surah[];
};

// Hard-coded list of 114 surahs (names only). Verse counts are omitted for brevity.
const SURAH_LIST: Surah[] = [
  { number: 1, name: "Al-Fatihah" },
  { number: 2, name: "Al-Baqarah" },
  { number: 3, name: "Aal-i-Imran" },
  { number: 4, name: "An-Nisa'" },
  { number: 5, name: "Al-Ma'idah" },
  { number: 6, name: "Al-An'am" },
  { number: 7, name: "Al-A'raf" },
  { number: 8, name: "Al-Anfal" },
  { number: 9, name: "At-Tawbah" },
  { number: 10, name: "Yunus" },
  { number: 11, name: "Hud" },
  { number: 12, name: "Yusuf" },
  { number: 13, name: "Ar-Ra'd" },
  { number: 14, name: "Ibrahim" },
  { number: 15, name: "Al-Hijr" },
  { number: 16, name: "An-Nahl" },
  { number: 17, name: "Al-Isra'" },
  { number: 18, name: "Al-Kahf" },
  { number: 19, name: "Maryam" },
  { number: 20, name: "Ta-Ha" },
  { number: 21, name: "Al-Anbiya" },
  { number: 22, name: "Al-Hajj" },
  { number: 23, name: "Al-Mu'minun" },
  { number: 24, name: "An-Nur" },
  { number: 25, name: "Al-Furqan" },
  { number: 26, name: "Ash-Shu'ara'" },
  { number: 27, name: "An-Naml" },
  { number: 28, name: "Al-Qasas" },
  { number: 29, name: "Al-Ankabut" },
  { number: 30, name: "Ar-Rum" },
  { number: 31, name: "Luqman" },
  { number: 32, name: "As-Sajdah" },
  { number: 33, name: "Al-Ahzab" },
  { number: 34, name: "Saba" },
  { number: 35, name: "Fatir" },
  { number: 36, name: "Ya-Sin" },
  { number: 37, name: "As-Saffat" },
  { number: 38, name: "Sad" },
  { number: 39, name: "Az-Zumar" },
  { number: 40, name: "Ghafir" },
  { number: 41, name: "Fussilat" },
  { number: 42, name: "Ash-Shura" },
  { number: 43, name: "Az-Zukhruf" },
  { number: 44, name: "Ad-Dukhan" },
  { number: 45, name: "Al-Jathiyah" },
  { number: 46, name: "Al-Ahqaf" },
  { number: 47, name: "Muhammad" },
  { number: 48, name: "Al-Fath" },
  { number: 49, name: "Al-Hujurat" },
  { number: 50, name: "Qaf" },
  { number: 51, name: "Adh-Dhariyat" },
  { number: 52, name: "At-Tur" },
  { number: 53, name: "An-Najm" },
  { number: 54, name: "Al-Qamar" },
  { number: 55, name: "Ar-Rahman" },
  { number: 56, name: "Al-Waqi'" },
  { number: 57, name: "Al-Hadid" },
  { number: 58, name: "Al-Mujadila" },
  { number: 59, name: "Al-Hashr" },
  { number: 60, name: "Al-Mumtahanah" },
  { number: 61, name: "As-Saff" },
  { number: 62, name: "Al-Jumu'ah" },
  { number: 63, name: "Al-Munafiqun" },
  { number: 64, name: "At-Taghabun" },
  { number: 65, name: "At-Talaq" },
  { number: 66, name: "At-Tahrim" },
  { number: 67, name: "Al-Mulk" },
  { number: 68, name: "Al-Qalam" },
  { number: 69, name: "Al-Haqqah" },
  { number: 70, name: "Al-Ma'arij" },
  { number: 71, name: "Nuh" },
  { number: 72, name: "Al-Jinn" },
  { number: 73, name: "Al-Muzzammil" },
  { number: 74, name: "Al-Muddathir" },
  { number: 75, name: "Al-Qiyamah" },
  { number: 76, name: "Al-Insan" },
  { number: 77, name: "Al-Mursalat" },
  { number: 78, name: "An-Naba'" },
  { number: 79, name: "An-Nazi'at" },
  { number: 80, name: "Abasa" },
  { number: 81, name: "At-Takwir" },
  { number: 82, name: "Al-Infitar" },
  { number: 83, name: "Al-Mutaffifin" },
  { number: 84, name: "Al-Inshiqaq" },
  { number: 85, name: "Al-Buruj" },
  { number: 86, name: "At-Tariq" },
  { number: 87, name: "Al-Ala" },
  { number: 88, name: "Al-Ghashiyah" },
  { number: 89, name: "Al-Fajr" },
  { number: 90, name: "Al-Balad" },
  { number: 91, name: "Ash-Shams" },
  { number: 92, name: "Al-Layl" },
  { number: 93, name: "Ad-Duha" },
  { number: 94, name: "Ash-Sharh" },
  { number: 95, name: "At-Tin" },
  { number: 96, name: "Al-Alaq" },
  { number: 97, name: "Al-Qadr" },
  { number: 98, name: "Al-Bayyinah" },
  { number: 99, name: "Az-Zalzalah" },
  { number: 100, name: "Al-Adiyat" },
  { number: 101, name: "Al-Qari'ah" },
  { number: 102, name: "At-Takathur" },
  { number: 103, name: "Al-Asr" },
  { number: 104, name: "Al-Humazah" },
  { number: 105, name: "Al-Fil" },
  { number: 106, name: "Quraysh" },
  { number: 107, name: "Al-Maun" },
  { number: 108, name: "Al-Kawthar" },
  { number: 109, name: "Al-Kafirun" },
  { number: 110, name: "An-Nasr" },
  { number: 111, name: "Al-Masad" },
  { number: 112, name: "Al-Ikhlas" },
  { number: 113, name: "Al-Falaq" },
  { number: 114, name: "An-Nas" },
];

interface Props {
  surahs?: Surah[];
  initialSelected?: number;
  onSelect?: (surahNumber: number) => void;
  currentPage?: number;
  basePath?: string;
  topOffset?: number;
}

export default function SurahNavPanel({ surahs = SURAH_LIST, initialSelected, onSelect, currentPage: currentPageProp, basePath, topOffset = 72 }: Props) {
  const [query, setQuery] = useState('');
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const hasAutoScrolledRef = useRef(false);

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentPage = useMemo(() => {
    if (typeof currentPageProp === 'number') {
      return currentPageProp;
    }

    const readerMatch = pathname.match(/^\/reader\/(\d+)/);
    if (readerMatch) {
      return Number.parseInt(readerMatch[1], 10);
    }

    const shareMatch = pathname.match(/^\/share\/[^/]+\/(\d+)/);
    if (shareMatch) {
      return Number.parseInt(shareMatch[1], 10);
    }

    return 1;
  }, [currentPageProp, pathname]);

  const groupedSurahs = useMemo<SurahPageGroup[]>(() => {
    const groups = new Map<number, Surah[]>();
    surahs.forEach(surah => {
      const page = SURAH_FIRST_PAGES[surah.number];
      if (!groups.has(page)) groups.set(page, []);
      groups.get(page)!.push(surah);
    });

    return Array.from(groups.entries())
      .sort(([a], [b]) => a - b)
      .map(([page, groupSurahs]) => ({ page, surahs: groupSurahs }));
  }, [surahs]);

  const activePage = useMemo(() => {
    let page = SURAH_FIRST_PAGES[initialSelected ?? 1] ?? 1;
    for (const group of groupedSurahs) {
      if (group.page <= currentPage) page = group.page;
      else break;
    }
    return page;
  }, [currentPage, groupedSurahs, initialSelected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groupedSurahs;
    return groupedSurahs.filter(group => (
      `${group.page}`.includes(q)
      || group.surahs.some(surah => (
        `${surah.number}`.includes(q)
        || surah.name.toLowerCase().includes(q)
        || (surah.englishName || '').toLowerCase().includes(q)
      ))
    ));
  }, [groupedSurahs, query]);

  useEffect(() => {
    if (query.trim()) return;
    if (hasAutoScrolledRef.current) return;
    if (!activeButtonRef.current) return;
    activeButtonRef.current.scrollIntoView({
      block: 'center',
      inline: 'nearest',
    });
    hasAutoScrolledRef.current = true;
  }, [activePage, query]);

  const handleSelect = async (group: SurahPageGroup) => {
    const flush = (window as any).__hifthFlushReaderCanvas as undefined | (() => Promise<void>);
    await flush?.();
    onSelect?.(group.surahs[0]?.number ?? 1);
    const params = new URLSearchParams(searchParams.toString());
    const query = params.toString();
    const targetPath = `${basePath ?? '/reader'}/${group.page}`;
    const targetHref = query ? `${targetPath}?${query}` : targetPath;
    const currentHref = query ? `${pathname}?${query}` : pathname;

    if (targetHref === currentHref) {
      return;
    }

    router.push(targetHref, { scroll: false });
  };


  const panel = (
    <aside
      data-testid="surah-panel"
      className="w-72 overflow-hidden border-r border-[var(--border-subtle)] bg-white/78 shadow-[18px_0_40px_rgba(15,23,42,0.06)] backdrop-blur-xl"
      style={{ position: 'fixed', left: 0, top: `${topOffset}px`, height: `calc(100vh - ${topOffset}px)`, overflow: 'auto', zIndex: 40, margin: 0, transform: 'none' }}
    >

      <div className="px-3 py-3">
        <div className="rounded-2xl border border-[var(--border-subtle)] bg-white/80 px-3 py-3 shadow-sm">
          <div className="flex items-center gap-3">
            <button className="flex-1 rounded-full bg-[var(--accent-solid)] py-2 text-sm font-semibold text-white shadow-sm">Surahs</button>
          </div>

          <div className="mt-3">
            <div className="relative">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)] pointer-events-none" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
                <circle cx="11" cy="11" r="6" strokeWidth={2} />
              </svg>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search Surah"
                className="w-full input input-sm"
                aria-label="Search Surah"
                style={{ background: 'transparent', paddingLeft: '3rem' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div data-testid="surah-scroll-list" className="overflow-auto px-2 pb-4 pt-1 h-[calc(100vh-248px)] thin-scroll">
        <ul className="space-y-1">
          {filtered.map(group => {
            const active = activePage === group.page;
            const primarySurah = group.surahs[0];
            const isMultiSurah = group.surahs.length > 1;
            return (
              <li key={group.page} className="px-2 py-1.5">
                <button
                  ref={active ? activeButtonRef : undefined}
                  type="button"
                  onClick={() => { void handleSelect(group); }}
                  className={`w-full rounded-2xl border px-3 text-left transition-all duration-150 active:scale-[0.985] ${isMultiSurah ? 'py-4' : 'py-3'} ${active ? 'border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm shadow-emerald-900/5 ring-1 ring-emerald-100' : 'border-transparent bg-white/45 text-[var(--text-primary)] hover:border-emerald-100 hover:bg-white/90 hover:shadow-sm'}`}
                >
                  <div className="min-w-0">
                    <div className={isMultiSurah ? 'flex flex-col gap-2' : ''}>
                        {group.surahs.map(surah => (
                          <div key={surah.number} className="flex items-center gap-3">
                            <span className={`inline-flex h-7 min-w-7 shrink-0 items-center justify-center rounded-xl px-2 text-[12px] font-bold tabular-nums shadow-sm ${active ? 'bg-white text-emerald-700 ring-1 ring-emerald-100' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'}`}>
                              {surah.number}
                            </span>
                            <span className={`min-w-0 truncate text-sm font-semibold leading-snug ${active ? 'text-emerald-950' : 'text-[var(--text-primary)]'}`}>
                              {surah.name}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className={`mt-2 pl-10 text-[12px] font-medium ${active ? 'text-emerald-700' : 'text-[var(--text-muted)]'}`}>
                        Page {group.page}{group.surahs.length > 1 ? ` · ${group.surahs.length} surahs` : primarySurah?.verses ? ` · ${primarySurah.verses} verses` : ''}
                      </div>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );

  if (typeof document !== 'undefined') {
    return createPortal(panel, document.body);
  }

  return panel;
}
