import { dehydrate, hydrate, type QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { persistQueryClientRestore, persistQueryClientSubscribe } from '@tanstack/react-query-persist-client';
import { get, set, del } from 'idb-keyval';
import { MAX_AGE, makeQueryClient } from './client';

export const IDB_KEY = 'hc-query';
// The buster currently allowed to write. The persister's throttled save can fire after a logout
// or user switch; without this it re-wrote the cache (empty, but tagged with the old user's id).
let bound: string | null = null;
const persister = createAsyncStoragePersister({
  storage: {
    getItem: get,
    setItem: async (k: string, v: unknown) => {
      if (bound && (v as { buster?: string }).buster === bound) await set(k, v);
    },
    removeItem: del,
  },
  key: IDB_KEY,
  // idb stores structured clones; skip the JSON round-trip.
  serialize: (c) => c as unknown as string,
  deserialize: (c) => c as unknown as ReturnType<typeof JSON.parse>,
});

export const buster = (userId: string) => `${userId}:${process.env.NEXT_PUBLIC_BUILD_ID ?? 'dev'}`;

// Restore this user's cache (the lib discards it on buster mismatch or age > maxAge),
// then keep persisting. Returns the unsubscribe. PRD 0016 E5.
// Restores into a scratch client and copies over only if `isCurrent()` still holds
// after the IDB read, so a superseded restore can never hydrate the shared client (E7).
export async function restoreFor(qc: QueryClient, userId: string, isCurrent: () => boolean = () => true) {
  const opts = { queryClient: qc, persister, buster: buster(userId), maxAge: MAX_AGE };
  const scratch = makeQueryClient();
  await persistQueryClientRestore({ ...opts, queryClient: scratch });
  if (!isCurrent()) return () => {};
  hydrate(qc, dehydrate(scratch));
  bound = opts.buster;
  const unsub = persistQueryClientSubscribe(opts);
  return () => {
    unsub();
    if (bound === opts.buster) bound = null;
  };
}

// Wipe memory + IDB, and unbind so no pending throttled save can write afterwards. PRD 0016 E6/E7.
export async function clearQueryCache(qc: QueryClient) {
  bound = null;
  qc.clear();
  await del(IDB_KEY);
}
