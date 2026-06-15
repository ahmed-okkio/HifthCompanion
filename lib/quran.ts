export const TOTAL_PAGES = 604;

export function getPageImageUrl(page: number): string {
  // Using local images in public/quran-pages/ for now as established in the previous turn,
  // but keeping structure for easier transition to remote storage if needed later.
  const padded = page.toString().padStart(3, '0');
  return `/quran-pages/${padded}.png`;
}

export function clampPage(page: number): number {
  return Math.max(1, Math.min(TOTAL_PAGES, page));
}
