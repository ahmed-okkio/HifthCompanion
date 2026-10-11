import { QueryClient, onlineManager } from '@tanstack/react-query';

// v5's onlineManager assumes online until an online/offline event fires, so an offline cold
// launch ran every fetcher and rendered their failures as empty data. Seed it from the browser so
// those queries pause: cached data stays, uncached sections show the offline note (E2/E4).
if (typeof navigator !== 'undefined') onlineManager.setOnline(navigator.onLine);

export const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // PRD 0016 dec. 6

export function makeQueryClient() {
  return new QueryClient({
    // refetchOnMount 'always': a just-restored IDB snapshot can look fresh yet predate the
    // last write (persist is throttled), so every mount revalidates in the background (E3).
    defaultOptions: { queries: { staleTime: 30_000, gcTime: MAX_AGE, refetchOnMount: 'always' } },
  });
}
