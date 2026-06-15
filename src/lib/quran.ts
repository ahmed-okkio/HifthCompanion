export const TOTAL_PAGES = 604;

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
