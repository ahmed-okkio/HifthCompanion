import surahFirstPagesData from '@/data/surahFirstPages.json';
import ayahCountsData from '@/data/ayahCountsBySurah.json';
import juzStartPagesData from '@/data/juzStartPages.json';
import pageFirstAyahData from '@/data/pageFirstAyah.json';
import surahNamesData from '@/data/surahNames.json';

export const TOTAL_PAGES = 604;
export const TOTAL_JUZ = 30;
export const TOTAL_SURAHS = 114;

export const SURAH_FIRST_PAGES: Record<number, number> = Object.fromEntries(
  Object.entries(surahFirstPagesData).map(([k, v]) => [Number(k), v])
);

/** Ayah count per surah (Hafs / Madani Mushaf, 6236 total). */
export const AYAH_COUNTS: Record<number, number> = Object.fromEntries(
  Object.entries(ayahCountsData).map(([k, v]) => [Number(k), v as number])
);

/** First page (1–604) of each juz (1–30), Madani Mushaf layout. */
export const JUZ_START_PAGES: Record<number, number> = Object.fromEntries(
  Object.entries(juzStartPagesData).map(([k, v]) => [Number(k), v as number])
);

export type AyahRef = { surah: number; ayah: number };

/** First ayah present on each page (1–604). */
export const PAGE_FIRST_AYAH: Record<number, AyahRef> = Object.fromEntries(
  Object.entries(pageFirstAyahData).map(([k, v]) => [Number(k), v as AyahRef])
);

/**
 * Returns the surah number (1–114) that contains the given page.
 * Derived from SURAH_FIRST_PAGES by finding the highest surah whose first page
 * is ≤ the target page.
 */
export function getSurahForPage(page: number): number {
  const entries = Object.entries(SURAH_FIRST_PAGES)
    .map(([k, v]) => ({ surah: Number(k), firstPage: v }))
    .sort((a, b) => a.firstPage - b.firstPage);

  let result = 1;
  for (const { surah, firstPage } of entries) {
    if (firstPage <= page) result = surah;
    else break;
  }
  return result;
}

export function getPageImageUrl(page: number): string {
  const padded = page.toString().padStart(3, '0');
  const baseUrl = process.env.NEXT_PUBLIC_IMAGE_BASE_URL;
  if (!baseUrl) {
    return `https://placeholder.supabase.co/storage/v1/object/public/quran-pages/tajweed/${padded}.png`;
  }
  return `${baseUrl}/${padded}.png`;
}

export function clampPage(page: number): number {
  return Math.max(1, Math.min(TOTAL_PAGES, page));
}

/** Number of ayahs in a surah (1–114). */
export function getAyahCount(surah: number): number {
  return AYAH_COUNTS[surah] ?? 0;
}

const SURAH_NAMES = surahNamesData as { en: Record<string, string>; ar: Record<string, string> };

/** Surah name in the given locale (defaults English). */
export function getSurahName(surah: number, locale: 'en' | 'ar' = 'en'): string {
  return SURAH_NAMES[locale]?.[String(surah)] ?? `Surah ${surah}`;
}

/** First page of a juz (1–30). */
export function getJuzStartPage(juz: number): number {
  return JUZ_START_PAGES[juz] ?? 1;
}

/** Juz number (1–30) containing the given page. */
export function getJuzForPage(page: number): number {
  const p = clampPage(page);
  let result = 1;
  for (let juz = 1; juz <= TOTAL_JUZ; juz++) {
    if (JUZ_START_PAGES[juz] <= p) result = juz;
    else break;
  }
  return result;
}

/**
 * The double-page spread [low, high] containing a page. low is odd, high even.
 * Pages pair (1,2),(3,4),…,(603,604) — 604 is even so no orphan.
 */
export function spreadOf(page: number): [number, number] {
  const p = clampPage(page);
  const low = p % 2 === 1 ? p : p - 1;
  return [low, low + 1];
}

/** URL segment for a spread, e.g. "3-4". */
export function spreadUrl(page: number): string {
  const [low, high] = spreadOf(page);
  return `${low}-${high}`;
}

/**
 * Parse a "low-high" spread segment back to [low, high], or null if it isn't a
 * valid spread (single page, reversed, out of range, garbage). Never throws.
 */
export function parseSpread(seg: string): [number, number] | null {
  const m = /^(\d+)-(\d+)$/.exec(seg);
  if (!m) return null;
  const low = Number(m[1]);
  const high = Number(m[2]);
  if (low % 2 !== 1 || high !== low + 1) return null;
  if (low < 1 || high > TOTAL_PAGES) return null;
  return [low, high];
}

// Cumulative ayahs before each surah → 1-based global ayah index across the Mushaf.
const AYAHS_BEFORE_SURAH: Record<number, number> = (() => {
  const acc: Record<number, number> = {};
  let total = 0;
  for (let s = 1; s <= TOTAL_SURAHS; s++) {
    acc[s] = total;
    total += getAyahCount(s);
  }
  return acc;
})();

/** 1-based global ayah index (1–6236) for a surah:ayah ref. */
export function globalAyahIndex(surah: number, ayah: number): number {
  return (AYAHS_BEFORE_SURAH[surah] ?? 0) + ayah;
}

/** The page (1–604) that contains a given surah:ayah. */
export function getPageForAyah(surah: number, ayah: number): number {
  const g = globalAyahIndex(surah, ayah);
  let result = 1;
  for (let p = 1; p <= TOTAL_PAGES; p++) {
    if (globalAyahIndex(PAGE_FIRST_AYAH[p].surah, PAGE_FIRST_AYAH[p].ayah) <= g) result = p;
    else break;
  }
  return result;
}

/**
 * All ayahs present on a page, in order. Derived from PAGE_FIRST_AYAH: a page
 * spans from its first ayah up to (but excluding) the next page's first ayah.
 */
export function getAyahsOnPage(page: number): AyahRef[] {
  const p = clampPage(page);
  const startG = globalAyahIndex(PAGE_FIRST_AYAH[p].surah, PAGE_FIRST_AYAH[p].ayah);
  const endG =
    p < TOTAL_PAGES
      ? globalAyahIndex(PAGE_FIRST_AYAH[p + 1].surah, PAGE_FIRST_AYAH[p + 1].ayah) - 1
      : globalAyahIndex(TOTAL_SURAHS, getAyahCount(TOTAL_SURAHS));
  const out: AyahRef[] = [];
  let surah = PAGE_FIRST_AYAH[p].surah;
  let ayah = PAGE_FIRST_AYAH[p].ayah;
  for (let g = startG; g <= endG; g++) {
    out.push({ surah, ayah });
    if (ayah >= getAyahCount(surah)) {
      surah += 1;
      ayah = 1;
    } else {
      ayah += 1;
    }
  }
  return out;
}
