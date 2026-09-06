'use client';
import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { clampPage, spreadUrl } from '@/lib/quran';

type ReaderWindow = Window & {
  /** Every mounted canvas registers a "show my skeleton" callback here (useCanvasPersistence). */
  __hifthCanvasSkeletons?: Set<() => void>;
  /** Flushes every mounted canvas's pending debounced save. */
  __hifthFlushReaderCanvas?: () => Promise<void>;
};

/**
 * The one way to change the reader's page. Every surface — prev/next arrows, the jump box,
 * the surah list, the Marked/annotations rows, the mobile drawer, the spread toggle — routes
 * through here so they behave identically:
 *
 *   1. paint the canvas skeleton FIRST, before anything is awaited,
 *   2. flush pending annotation saves,
 *   3. push the spread-aware URL, query preserved minus the stale `page` param.
 *
 * Step 1 before step 2 is the whole point: the flush is a network round-trip, so a caller
 * that only pushes after it resolves leaves the UI looking frozen for the length of the save.
 */
export function useGoToPage(
  { basePath = '/reader', isSpread = false }: { basePath?: string; isSpread?: boolean } = {},
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hrefFor = useCallback((page: number, spread = isSpread) => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page'); // a stale ?page= from a legacy link would fight the path segment
    const qs = params.toString();
    const clamped = clampPage(page);
    return `${basePath}/${spread ? spreadUrl(clamped) : clamped}${qs ? `?${qs}` : ''}`;
  }, [basePath, isSpread, searchParams]);

  /** Resolves false when the target is the page already open (no navigation happened). */
  const goToPage = useCallback(async (page: number, spread = isSpread) => {
    const href = hrefFor(page, spread);
    if (href.split('?')[0] === pathname) return false;

    const w = window as ReaderWindow;
    w.__hifthCanvasSkeletons?.forEach(paint => paint());
    await w.__hifthFlushReaderCanvas?.();
    router.push(href, { scroll: false });
    return true;
  }, [hrefFor, isSpread, pathname, router]);

  return { goToPage, hrefFor };
}
