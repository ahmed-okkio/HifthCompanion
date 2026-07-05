import { describe, it, expect } from 'vitest';
import { createAnnotationStore, createFakeAnnotationStore, type CanvasJson } from '@/lib/annotationStore';

// Minimal hand-written stub matching the Supabase query chain the store uses.
function stubClient(opts: {
  maybeSingle?: { data: any; error: any };
  upsertError?: any;
  deleteError?: any;
}) {
  const calls: any = { upsert: null, delete: null };
  const client = {
    from() {
      return {
        select() {
          return {
            eq() {
              return {
                eq() {
                  return {
                    async maybeSingle() {
                      return opts.maybeSingle ?? { data: null, error: null };
                    },
                  };
                },
              };
            },
          };
        },
        upsert(row: any, config: any) {
          calls.upsert = { row, config };
          return Promise.resolve({ error: opts.upsertError ?? null });
        },
        delete() {
          return {
            match(m: any) {
              calls.delete = m;
              return Promise.resolve({ error: opts.deleteError ?? null });
            },
          };
        },
      };
    },
  };
  return { client, calls };
}

const nonEmpty: CanvasJson = { objects: [{ type: 'path' }], width: 800, height: 600 };
const empty: CanvasJson = { objects: [], width: 800, height: 600 };

describe('createAnnotationStore.save', () => {
  it('empty objects → DELETE, no upsert, saved', async () => {
    const { client, calls } = stubClient({});
    const res = await createAnnotationStore(client).save('s1', 3, empty);
    expect(res).toEqual({ status: 'saved' });
    expect(calls.delete).toEqual({ set_id: 's1', page_number: 3 });
    expect(calls.upsert).toBeNull();
  });

  it('non-empty → upsert with onConflict and full row, saved', async () => {
    const { client, calls } = stubClient({});
    const res = await createAnnotationStore(client).save('s1', 3, nonEmpty);
    expect(res).toEqual({ status: 'saved' });
    expect(calls.upsert.config.onConflict).toBe('set_id,page_number');
    expect(calls.upsert.row.set_id).toBe('s1');
    expect(calls.upsert.row.page_number).toBe(3);
    expect(calls.upsert.row.canvas_json).toBe(nonEmpty);
    expect(typeof calls.upsert.row.updated_at).toBe('string');
  });

  it('upsert error code 42501 → denied', async () => {
    const { client } = stubClient({ upsertError: { code: '42501' } });
    expect(await createAnnotationStore(client).save('s1', 3, nonEmpty)).toEqual({ status: 'denied' });
  });

  it('upsert error permission-denied message → denied', async () => {
    const { client } = stubClient({ upsertError: { message: 'permission denied for table annotations' } });
    expect(await createAnnotationStore(client).save('s1', 3, nonEmpty)).toEqual({ status: 'denied' });
  });

  it('upsert transient/network error → error, not denied', async () => {
    const { client } = stubClient({ upsertError: { message: 'fetch failed' } });
    const res = await createAnnotationStore(client).save('s1', 3, nonEmpty);
    expect(res.status).toBe('error');
  });
});

describe('createAnnotationStore.load', () => {
  it('returns stored canvas_json', async () => {
    const { client } = stubClient({ maybeSingle: { data: { canvas_json: nonEmpty }, error: null } });
    expect(await createAnnotationStore(client).load('s1', 3)).toBe(nonEmpty);
  });

  it('missing row → null', async () => {
    const { client } = stubClient({ maybeSingle: { data: null, error: null } });
    expect(await createAnnotationStore(client).load('s1', 3)).toBeNull();
  });

  it('load with error → throws', async () => {
    const { client } = stubClient({ maybeSingle: { data: null, error: { message: 'boom' } } });
    await expect(createAnnotationStore(client).load('s1', 3)).rejects.toEqual({ message: 'boom' });
  });
});

describe('createFakeAnnotationStore', () => {
  it('round-trips save/load and empty removes', async () => {
    const store = createFakeAnnotationStore();
    expect(await store.load('s1', 3)).toBeNull();
    await store.save('s1', 3, nonEmpty);
    expect(await store.load('s1', 3)).toBe(nonEmpty);
    await store.save('s1', 3, empty);
    expect(await store.load('s1', 3)).toBeNull();
  });
});
