import { getPageImageUrl, TOTAL_PAGES, clampPage } from './quran';

/** Pages we've already asked the browser to fetch this session. */
const warmed = new Set<number>();

const idle: (cb: () => void) => void =
  (typeof window !== 'undefined' && (window as unknown as { requestIdleCallback?: (cb: () => void) => void }).requestIdleCallback) ||
  ((cb: () => void) => setTimeout(cb, 200));

/**
 * Warm the image cache for the pages around `page` so a flip is a cache hit.
 *
 * The service worker stores these permanently, so this is a one-time cost per page:
 * flipping through the Mushaf leaves a growing window of instant pages behind it.
 *
 * ponytail: one request at a time, nearest page first, on idle — a 20-way parallel burst
 * would contend with the page the user is actually looking at, and the whole ±10 window
 * lands in a couple of seconds anyway. No concurrency tuning until that measurably falls short.
 */
export function prefetchPageImages(page: number, radius = 10): void {
  if (typeof window === 'undefined') return;
  const centre = clampPage(page);

  const queue: number[] = [];
  for (let i = 0; i <= radius; i++) {
    for (const p of i === 0 ? [centre] : [centre + i, centre - i]) {
      if (p < 1 || p > TOTAL_PAGES || warmed.has(p)) continue;
      warmed.add(p);
      queue.push(p);
    }
  }

  const next = () => {
    const p = queue.shift();
    if (p === undefined) return;
    const img = new Image();
    // Must match the fabric background loader's mode, or the two requests land in
    // separate HTTP cache entries and every page is fetched twice.
    img.crossOrigin = 'anonymous';
    img.onload = img.onerror = () => idle(next);
    img.src = getPageImageUrl(p);
  };
  idle(next);
}
