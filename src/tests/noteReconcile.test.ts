import { describe, it, expect } from 'vitest';
import { diffNoteBindings, type BoundNoteRow } from '@/lib/noteReconcile';

const row = (o: Partial<BoundNoteRow>): BoundNoteRow => ({ id: 'n', fabric_object_id: 'A', ...o });

describe('diffNoteBindings', () => {
  it('soft-deletes notes whose object left the canvas (E1, E2)', () => {
    const rows = [row({ id: 'a', fabric_object_id: 'A' }), row({ id: 'b', fabric_object_id: 'B' })];
    expect(diffNoteBindings(rows, ['A'])).toEqual({ softDelete: ['b'], restore: [] });
  });

  it('restores notes when undo brings the object back (E3)', () => {
    const rows = [row({ id: 'b', fabric_object_id: 'B', deleted_at: '2026-01-01T00:00:00Z' })];
    expect(diffNoteBindings(rows, ['B'])).toEqual({ softDelete: [], restore: ['b'] });
  });

  it('clearing the page soft-deletes every bound note (E4)', () => {
    const rows = [row({ id: 'a', fabric_object_id: 'A' }), row({ id: 'b', fabric_object_id: 'B' })];
    expect(diffNoteBindings(rows, [])).toEqual({ softDelete: ['a', 'b'], restore: [] });
  });

  it('leaves an un-undone erase soft-deleted across later saves (E5)', () => {
    const rows = [row({ id: 'b', fabric_object_id: 'B', deleted_at: '2026-01-01T00:00:00Z' })];
    expect(diffNoteBindings(rows, ['A', 'C'])).toEqual({ softDelete: [], restore: [] });
  });

  it('never touches unbound notes (E6)', () => {
    const rows = [row({ id: 'u', fabric_object_id: null }), row({ id: 'u2', fabric_object_id: undefined })];
    expect(diffNoteBindings(rows, [])).toEqual({ softDelete: [], restore: [] });
  });

  it('is a no-op when nothing changed', () => {
    const rows = [row({ id: 'a', fabric_object_id: 'A' })];
    expect(diffNoteBindings(rows, ['A'])).toEqual({ softDelete: [], restore: [] });
  });
});
