import type { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClientRestore, persistQueryClientSubscribe } from '@tanstack/react-query-persist-client';
import { get, set, del } from 'idb-keyval';
import { MAX_AGE } from './client';

export const IDB_KEY = 'hc-query';
const persister = createAsyncStoragePersister({
  storage: { getItem: get, setItem: set, removeItem: del },
  key: IDB_KEY,
  // idb stores structured clones; skip the JSON round-trip.
  serialize: (c) => c as unknown as string,
  deserialize: (c) => c as unknown as ReturnType<typeof JSON.parse>,
});

export const buster = (userId: string) => `${userId}:${process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'}`;

// Restore this user's cache (the lib discards it on buster mismatch or age > maxAge),
// then keep persisting. Returns the unsubscribe. PRD 0016 E5.
export async function restoreFor(qc: QueryClient, userId: string) {
  const opts = { queryClient: qc, persister, buster: buster(userId), maxAge: MAX_AGE };
  await persistQueryClientRestore(opts);
  return persistQueryClientSubscribe(opts);
}

// Wipe memory + IDB. Clear while still subscribed so any pending throttled save
// carries the empty cache, not the old one. PRD 0016 E6/E7.
export async function clearQueryCache(qc: QueryClient) {
  qc.clear();
  await del(IDB_KEY);
}
