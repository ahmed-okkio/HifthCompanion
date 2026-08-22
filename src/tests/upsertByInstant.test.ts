import { describe, expect, it } from 'vitest';
import { upsertByInstant } from '@/components/tracker/TeacherStudent';
import type { Session } from '@/types';

const row = (over: Partial<Session>): Session => ({
  id: 'a', membership_id: 'm', scheduled_at: '2026-08-20T17:00:00.000Z',
  is_adhoc: false, canceled: false, attendance_status: null, moved_from: null,
  created_at: '2026-08-01T00:00:00.000Z', ...over,
});

describe('upsertByInstant (optimistic session rows)', () => {
  it('swaps a placeholder for the stored row at the same instant, in either ISO shape', () => {
    const placeholder = row({ id: 'pending-1', canceled: true });
    const stored = row({ id: 'real-1', scheduled_at: '2026-08-20T17:00:00+00:00', canceled: true });
    const out = upsertByInstant([placeholder], stored);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('real-1');
  });

  it('moves a rescheduled row off its original instant instead of duplicating it', () => {
    const original = row({ id: 'real-1' });
    const moved = row({ id: 'real-1', scheduled_at: '2026-08-22T17:00:00.000Z', moved_from: original.scheduled_at });
    const out = upsertByInstant([original], moved);
    expect(out).toHaveLength(1);
    expect(out[0].scheduled_at).toBe('2026-08-22T17:00:00.000Z');
  });

  it('never swallows the session already sitting at the destination instant', () => {
    const occupant = row({ id: 'occupant', scheduled_at: '2026-08-22T17:00:00.000Z' });
    const moved = row({ id: 'real-1', scheduled_at: '2026-08-22T17:00:00.000Z', moved_from: '2026-08-20T17:00:00.000Z' });
    const out = upsertByInstant([row({ id: 'real-1' }), occupant], moved);
    expect(out.map((r) => r.id).sort()).toEqual(['occupant', 'real-1']);
  });

  it('appends a row for an instant it has never seen', () => {
    const out = upsertByInstant([], row({}));
    expect(out).toHaveLength(1);
  });

  it('keeps the list sorted by time', () => {
    const late = row({ id: 'late', scheduled_at: '2026-08-25T17:00:00.000Z' });
    const early = row({ id: 'early', scheduled_at: '2026-08-19T17:00:00.000Z' });
    expect(upsertByInstant([late], early).map((r) => r.id)).toEqual(['early', 'late']);
  });
});
