import { describe, it, expect } from 'vitest';
import { computeBadges } from '@/components/NoteBadgeLayer';
import type { Note } from '@/types';

const note = (o: Partial<Note>): Note => ({
  id: 'n', set_id: 's', page_number: 1, body: 'b', x: null, y: null,
  created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
  fabric_object_id: null, ...o,
} as Note);

describe('computeBadges', () => {
  it('numbers objects by their first note and counts duplicates', () => {
    const notes = [
      note({ id: 'b1', fabric_object_id: 'B', created_at: '2026-01-02T00:00:00Z' }),
      note({ id: 'a1', fabric_object_id: 'A', created_at: '2026-01-01T00:00:00Z' }),
      note({ id: 'a2', fabric_object_id: 'A', created_at: '2026-01-03T00:00:00Z' }),
    ];
    expect(computeBadges(notes)).toEqual([
      { objectId: 'A', index: 1, count: 2 },
      { objectId: 'B', index: 2, count: 1 },
    ]);
    // stable regardless of fetch order
    expect(computeBadges([...notes].reverse())).toEqual(computeBadges(notes));
  });

  it('ignores unbound and soft-deleted notes', () => {
    expect(computeBadges([
      note({ id: 'u' }),
      note({ id: 'd', fabric_object_id: 'A', deleted_at: '2026-01-04T00:00:00Z' } as Partial<Note>),
    ])).toEqual([]);
  });
});
