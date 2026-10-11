import type { QueryKey } from '@tanstack/react-query';
import { queryClient } from '@/lib/query/Provider';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { isLocale, defaultLocale } from '@/lib/i18n/config';

/**
 * Wrap a write (PRD 0016 E9/E10): refused up front when the browser is offline (an error,
 * never a silent loss), and `key` (a prefix) is invalidated once it settles so every screen
 * refetches the new value. Components keep their own optimistic local state on top.
 */
export function guarded<A extends unknown[], R>(key: QueryKey, fn: (...a: A) => Promise<R>) {
  return async (...a: A): Promise<R> => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const lang = document.documentElement.lang;
      throw new Error(getDictionary(isLocale(lang) ? lang : defaultLocale)['common.offlineWrite']);
    }
    try {
      return await fn(...a);
    } finally {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}
