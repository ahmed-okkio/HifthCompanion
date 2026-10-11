import { QueryClient } from '@tanstack/react-query';

export const MAX_AGE = 7 * 24 * 60 * 60 * 1000; // PRD 0016 dec. 6

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, gcTime: MAX_AGE } },
  });
}
