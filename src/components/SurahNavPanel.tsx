'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export type Surah = {
  number: number;
  name: string;
  englishName?: string;
  verses?: number;
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
}

export default function SurahNavPanel({ surahs = SURAH_LIST, initialSelected, onSelect }: Props) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<number | null>(initialSelected ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return surahs;
    return surahs.filter(s => (`${s.number}`.includes(q)
      || s.name.toLowerCase().includes(q)
      || (s.englishName || '').toLowerCase().includes(q)));
  }, [surahs, query]);

  const router = useRouter();

  // map of surah -> first page
  const [firstPages, setFirstPages] = useState<Record<number, number> | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch('https://api.quran.com/api/v4/chapters');
        if (!res.ok) return;
        const json = await res.json();
        const map: Record<number, number> = {};
        (json.chapters || []).forEach((c: any) => {
          if (c.id && Array.isArray(c.pages) && c.pages.length) map[c.id] = c.pages[0];
        });
        if (mounted) setFirstPages(map);
      } catch (err) {
        // ignore network errors; firstPages remains null
      }
    })();
    return () => { mounted = false; };
  }, []);

  const handleSelect = (n: number) => {
    setSelected(n);
    onSelect?.(n);
    // navigate if we have a first page mapping
    const first = firstPages?.[n];
    if (typeof first === 'number') {
      router.push(`/reader/${first}`);
    }
  };


  return (
    <aside className="w-72 bg-[var(--bg-card)] rounded-xl border border-[var(--border-subtle)] overflow-hidden shadow-sm lg:sticky lg:top-[88px]" style={{ marginLeft: 'calc((100vw - 100%) / -2)' }}>

      <div className="px-3 py-3">
        <div className="px-3 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
          <div className="flex items-center gap-3">
            <button className="flex-1 py-2 rounded-full text-sm font-semibold bg-[var(--bg-card)]">Surahs</button>
            <button className="py-2 px-3 rounded-full text-sm text-[var(--text-muted)]">Juz</button>
          </div>

          <div className="mt-3">
            <div className="relative">
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search Surah"
                className="w-full input input-sm pl-10"
                aria-label="Search Surah"
                style={{ background: 'transparent' }}
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
                <circle cx="11" cy="11" r="6" strokeWidth={2} />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-auto px-1 py-2 h-[calc(100vh-260px)] thin-scroll">
        <ul className="divide-y divide-[var(--border-subtle)]">
          {filtered.map(s => {
            const active = selected === s.number;
            return (
              <li key={s.number} className={`px-3 py-3 cursor-pointer ${active ? 'bg-[var(--accent)] text-white rounded-lg mr-2 ml-2' : 'hover:bg-[rgba(0,0,0,0.03)]'} `}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3" onClick={() => handleSelect(s.number)}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${active ? 'bg-white/10 text-white' : 'bg-[var(--bg-card)] text-[var(--text-primary)]'}`}>
                      {s.number}
                    </div>
                    <div className="text-sm">
                      <div className="font-medium">{s.name}</div>
                      {typeof s.verses === 'number' && s.verses > 0 ? (
                        <div className="text-[12px] text-[var(--text-muted)]">{s.verses} verses</div>
                      ) : null}
                    </div>
                  </div>

                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
