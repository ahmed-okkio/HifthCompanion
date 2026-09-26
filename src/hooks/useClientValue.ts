import { useSyncExternalStore } from 'react';

const noSubscribe = () => () => {};

/** Client-only value (localStorage, location…): `server` during SSR + hydration, then `get()`
 *  re-read on every render. No subscription — callers re-render on their own triggers.
 *  `get` must return a primitive (or a stable reference). */
export function useClientValue<T>(get: () => T, server: T): T {
  return useSyncExternalStore(noSubscribe, get, () => server);
}
