import { QueryClient } from '@tanstack/react-query';

export const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // PRD 0016 dec. 6

export function makeQueryClient() {
  return new QueryClient({
    // refetchOnMount 'always': a just-restored IDB snapshot can look fresh yet predate the
    // last write (persist is throttled), so every mount revalidates in the background (E3).
    defaultOptions: { queries: { staleTime: 30_000, gcTime: MAX_AGE, refetchOnMount: 'always' } },
  });
}
