'use client';
import { usePathname as useNextPathname } from 'next/navigation';

/** Visible pathname. Under cacheComponents a prerendered shell sees the internal `/{locale}/x`
 *  path while the browser sees `/x` (proxy rewrite, PRD 0016 B1); strip it so shell and
 *  client render identically (otherwise hydration fails, #418). */
export function usePathname(): string {
  return (useNextPathname() ?? '').replace(/^\/(en|ar)(?=\/|$)/, '') || '/';
}
