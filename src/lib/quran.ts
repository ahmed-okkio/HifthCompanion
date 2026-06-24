import surahFirstPagesData from '@/data/surahFirstPages.json';

export const TOTAL_PAGES = 604;

export const SURAH_FIRST_PAGES: Record<number, number> = Object.fromEntries(
  Object.entries(surahFirstPagesData).map(([k, v]) => [Number(k), v])
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
