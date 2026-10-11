import { vi, describe, it, expect, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';

const store = new Map<string, unknown>();
let getGate: Promise<void> | null = null; // blocks the next IDB read once
vi.mock('idb-keyval', () => ({
  get: async (k: string) => { const g = getGate; getGate = null; if (g) await g; return store.get(k); },
  set: async (k: string, v: unknown) => { store.set(k, v); },
  del: async (k: string) => { store.delete(k); },
}));

let authCb: ((e: string, s: { user: { id: string } } | null) => void) | undefined;
let sessionUser: string | null = 'A';
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: sessionUser ? { user: { id: sessionUser } } : null } }),
      onAuthStateChange: (cb: typeof authCb) => { authCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
    },
  }),
}));

import { makeQueryClient } from '@/lib/query/client';
import { restoreFor, clearQueryCache, IDB_KEY, buster } from '@/lib/query/persist';

const flushSave = () => new Promise((r) => setTimeout(r, 1100)); // persister throttles 1s

async function seedFor(userId: string, value: string) {
  const qc = makeQueryClient();
  const unsub = await restoreFor(qc, userId);
  qc.setQueryData(['k'], value);
  await flushSave();
  unsub();
}

describe('query cache persistence (PRD 0016 E5-E7, F3)', () => {
  beforeEach(() => { store.clear(); vi.unstubAllEnvs(); });

  it('restores for the same user and build', async () => {
    await seedFor('A', 'a-data');
    expect((store.get(IDB_KEY) as { buster: string }).buster).toBe(buster('A'));
    const qc = makeQueryClient();
    (await restoreFor(qc, 'A'))();
    expect(qc.getQueryData(['k'])).toBe('a-data');
  });

  it('discards on user mismatch (E5/E7)', async () => {
    await seedFor('A', 'a-data');
    const qc = makeQueryClient();
    (await restoreFor(qc, 'B'))();
    expect(qc.getQueryData(['k'])).toBeUndefined();
    expect(store.has(IDB_KEY)).toBe(false);
  });

  it('discards on build mismatch (E5)', async () => {
    await seedFor('A', 'a-data');
    vi.stubEnv('NEXT_PUBLIC_BUILD_ID', 'other-build');
    const qc = makeQueryClient();
    (await restoreFor(qc, 'A'))();
    expect(qc.getQueryData(['k'])).toBeUndefined();
  });

  it('clearQueryCache wipes memory and IDB (E6)', async () => {
    await seedFor('A', 'a-data');
    const qc = makeQueryClient();
    qc.setQueryData(['k'], 'x');
    await clearQueryCache(qc);
    expect(qc.getQueryData(['k'])).toBeUndefined();
    expect(store.has(IDB_KEY)).toBe(false);
  });

  it('a save still pending at logout writes nothing, not even the old buster (E6)', async () => {
    const qc = makeQueryClient();
    await restoreFor(qc, 'A');
    qc.setQueryData(['k'], 'a-data'); // schedules a throttled save
    await clearQueryCache(qc);
    await flushSave();
    expect(store.has(IDB_KEY)).toBe(false);
  });

  it('provider: user switch clears memory before the next render; no session restores nothing', async () => {
    await seedFor('A', 'a-data');
    const { QueryProvider, queryClient } = await import('@/lib/query/Provider');
    render(<QueryProvider>{null}</QueryProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(queryClient.getQueryData(['k'])).toBe('a-data');

    act(() => authCb!('SIGNED_IN', { user: { id: 'B' } }));
    expect(queryClient.getQueryData(['k'])).toBeUndefined(); // synchronous, before B renders
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(queryClient.getQueryData(['k'])).toBeUndefined();

    act(() => authCb!('SIGNED_OUT', null));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(store.has(IDB_KEY)).toBe(false);
  });

  it('provider: a restore superseded by a new user never hydrates (E7 race)', async () => {
    vi.resetModules();
    await seedFor('A', 'a-data');
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    getGate = gate;
    sessionUser = 'A';
    const { QueryProvider, queryClient } = await import('@/lib/query/Provider');
    render(<QueryProvider>{null}</QueryProvider>);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); }); // A's restore is now blocked on IDB
    act(() => authCb!('SIGNED_IN', { user: { id: 'B' } }));
    await act(async () => { release(); await new Promise((r) => setTimeout(r, 20)); });
    expect(queryClient.getQueryData(['k'])).toBeUndefined();
    await act(async () => { await flushSave(); });
    const saved = store.get(IDB_KEY) as { clientState: { queries: { state: { data: unknown } }[] } } | undefined;
    expect(JSON.stringify(saved ?? null)).not.toContain('a-data');
  });
});
