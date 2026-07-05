import { describe, it, expect } from 'vitest';
import { createFakeAnnotationStore, type CanvasJson } from '@/lib/annotationStore';

// Contract F1 — DOCUMENTED last-write-wins limitation (not a bug).
//
// Production: `useAnnotationCanvas.saveCanvas` routes through `annotationStore.save`,
// which upserts the `annotations` row with `{ onConflict: 'set_id,page_number' }`. The
// table has `unique (set_id, page_number)`, so two saves to the same page collapse onto
// ONE row — the later save overwrites the earlier one. No locking/merge: a concurrent
// edit silently loses the older payload. This is the ACCEPTED behavior.
//
// The onConflict wiring itself is covered by annotationStore.test.ts. Here we drive the
// REAL seam (createFakeAnnotationStore) to prove last-write-wins on the same (setId,page):
// no integration DB runs in CI, so the in-memory store models the collapse.

describe('F1: sequential saves to same (set_id, page) — last write wins', () => {
  it('load returns the second payload; the first is overwritten', async () => {
    const store = createFakeAnnotationStore();
    const setId = 'set-1';
    const page = 42;

    const first: CanvasJson = { width: 800, height: 1132, objects: [{ id: 'first' }] };
    const second: CanvasJson = { width: 800, height: 1132, objects: [{ id: 'second' }] };

    expect(await store.save(setId, page, first)).toEqual({ status: 'saved' });
    expect(await store.save(setId, page, second)).toEqual({ status: 'saved' });

    expect(await store.load(setId, page)).toEqual(second);
  });
});
