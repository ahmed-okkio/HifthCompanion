'use client';
import { useSyncExternalStore } from 'react';
import { usePathname as useNextPathname } from 'next/navigation';
import { shellRewrite } from '@/lib/shellRewrites';

const noop = () => () => {};
/** False while hydrating a prerendered shell, true after (and for anything mounted later). */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

/** Visible pathname. Under cacheComponents a prerendered shell sees the internal `/{locale}/x`
 *  path while the browser sees `/x` (proxy rewrite, PRD 0016 B1); strip it so shell and
 *  client render identically (otherwise hydration fails, #418). A mapped dynamic route
 *  (/reader/9, served by the static /reader/view shell) hydrates as its shell path, then
 *  re-renders with the visible one. */
export function usePathname(): string {
  const path = (useNextPathname() ?? '').replace(/^\/(en|ar)(?=\/|$)/, '') || '/';
  return useHydrated() ? path : (shellRewrite(path) ?? path);
}
