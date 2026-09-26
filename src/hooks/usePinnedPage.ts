import { useReducer } from 'react';
import { pinStorageKey } from '@/lib/bookmark';
import { useClientValue } from '@/hooks/useClientValue';

/** The mushaf's bookmarked ("default") page, read from localStorage (null during SSR). */
export function usePinnedPage(basePath?: string): [number | null, (page: number) => void] {
  const key = pinStorageKey(basePath);
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const raw = useClientValue(() => localStorage.getItem(key), null);
  const n = raw ? parseInt(raw, 10) : NaN;
  const pinned = !isNaN(n) && n > 0 ? n : null;

  const toggle = (page: number) => {
    if (pinned === page) localStorage.removeItem(key);
    else localStorage.setItem(key, String(page));
    rerender();
  };
  return [pinned, toggle];
}
