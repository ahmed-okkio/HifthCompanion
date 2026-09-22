import { PAGE_FIRST_AYAH, AYAH_COUNTS, getSurahName, TOTAL_SURAHS } from '@/lib/quran';

// ---------------------------------------------------------------------------
// 0015 wird — reference resolution. Presentation only, nothing persisted (G6).
// A portion is a page range; these turn its bounds into sūra name + ayah so no
// surface ever renders a bare colon reference like "18:62" (G3).
// ---------------------------------------------------------------------------

export interface ResolvedRef {
  surah: number;
  ayah: number;
  /** Sūra name + ayah, e.g. "Al-Kahf 62" — never a bare colon reference (G3). */
  label: string;
}

const asLabel = (surah: number, ayah: number, locale: 'en' | 'ar'): string =>
  `${getSurahName(surah, locale)} ${ayah}`;

/**
 * Opening reference (G1): the first ayah on `pageStart`. A scope whose first
 * page falls mid-sūra resolves to that ayah's real sūra, not the named one —
 * e.g. page 293 of an "al-Kahf" scope opens at Al-Isrā 105, not "Al-Kahf 1" (G5).
 */
export function openingRef(pageStart: number, locale: 'en' | 'ar' = 'en'): ResolvedRef {
  const a = PAGE_FIRST_AYAH[pageStart];
  return { surah: a.surah, ayah: a.ayah, label: asLabel(a.surah, a.ayah, locale) };
}

/**
 * Closing reference (G2): PAGE_FIRST_AYAH[pageEnd+1] decremented by one ayah,
 * rolling back to the previous sūra's last ayah (via AYAH_COUNTS) when the
 * decrement crosses a sūra boundary. Page 604 has no successor, so it resolves
 * to the last ayah of the mushaf — An-Nās 6.
 */
export function closingRef(pageEnd: number, locale: 'en' | 'ar' = 'en'): ResolvedRef {
  let surah: number;
  let ayah: number;
  const next = PAGE_FIRST_AYAH[pageEnd + 1];
  if (!next) {
    surah = TOTAL_SURAHS;
    ayah = AYAH_COUNTS[TOTAL_SURAHS];
  } else if (next.ayah > 1) {
    surah = next.surah;
    ayah = next.ayah - 1;
  } else {
    surah = next.surah - 1;
    ayah = AYAH_COUNTS[surah];
  }
  return { surah, ayah, label: asLabel(surah, ayah, locale) };
}
