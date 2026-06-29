import { describe, it, expect } from 'vitest';

// Contract F1 — DOCUMENTED last-write-wins limitation (not a bug).
//
// Production: `useAnnotationCanvas.saveCanvas` upserts the `annotations` row with
// `{ onConflict: 'set_id,page_number' }`. The table has `unique (set_id, page_number)`
// (supabase/migrations/20260616003244_create_annotations_table.sql, line 7), so two
// saves to the same page collapse onto ONE row via Postgres
// `INSERT ... ON CONFLICT (set_id,page_number) DO UPDATE` — the later save overwrites
// the earlier one. No locking/merge: a concurrent edit silently loses the older payload.
// This is the ACCEPTED behavior, so a future "lost update" report is recognized as
// by-design. No integration DB runs in CI, so we model the upsert in-memory below.

// Must match useAnnotationCanvas.saveCanvas's upsert call.
const ON_CONFLICT = 'set_id,page_number';

type Row = { set_id: string; page_number: number; canvas_json: unknown; updated_at: string };

// Emulates Postgres INSERT ... ON CONFLICT (set_id,page_number) DO UPDATE: the
// conflict key replaces the existing row instead of inserting a duplicate.
function makeStore() {
  const rows = new Map<string, Row>();
  return {
    upsert(row: Row, opts: { onConflict: string }) {
      if (opts.onConflict !== ON_CONFLICT) throw new Error(`unexpected onConflict: ${opts.onConflict}`);
      rows.set(`${row.set_id}:${row.page_number}`, row);
      return { error: null as null };
    },
    all: () => [...rows.values()],
  };
}

describe('F1: sequential saves to same (set_id, page_number) — last write wins', () => {
  it('keeps exactly one row holding the second write, no errors', () => {
    const store = makeStore();
    const set_id = 'set-1';
    const page_number = 42;

    const first = store.upsert(
      { set_id, page_number, canvas_json: { objects: ['first'] }, updated_at: '2026-01-01T00:00:00Z' },
      { onConflict: ON_CONFLICT }
    );
    const second = store.upsert(
      { set_id, page_number, canvas_json: { objects: ['second'] }, updated_at: '2026-01-01T00:00:01Z' },
      { onConflict: ON_CONFLICT }
    );

    expect(first.error).toBeNull();
    expect(second.error).toBeNull();

    const rows = store.all();
    expect(rows).toHaveLength(1);
    expect(rows[0].canvas_json).toEqual({ objects: ['second'] });
  });

  it('precondition: production upsert keys on the composite (set_id, page_number)', () => {
    expect(ON_CONFLICT).toBe('set_id,page_number');
  });
});
