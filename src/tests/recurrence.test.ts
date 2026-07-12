import { describe, it, expect } from 'vitest';
import { recurringSlots, missingSlots, sectionSessions } from '../lib/recurrence';
import type { Recurrence, Session } from '../types';

// Fixed Monday for determinism: 2026-06-29 is a Monday (UTC).
// Wall-clock floats (R3/R4): assertions read the ISO string / getUTC* so they
// are timezone-independent and hold under any host TZ. Run under a shifted TZ
// to prove it, e.g.  TZ=Pacific/Kiritimati npx vitest run recurrence  (or
// TZ='America/Los_Angeles'); slots must still show 17:00 on Mondays.
const MON = new Date('2026-06-29T00:00:00Z');

// "…T17:00" regardless of viewer TZ.
const wallClock = (iso: string) => iso.slice(11, 16);

describe('recurringSlots', () => {
  it('returns [] for null rule or empty weekdays', () => {
    expect(recurringSlots(null, MON)).toEqual([]);
    expect(recurringSlots({ weekdays: [], time: '17:00' }, MON)).toEqual([]);
  });

  it('emits one slot per matching weekday in the horizon', () => {
    const rule: Recurrence = { weekdays: [1], time: '17:00' }; // Mondays
    const slots = recurringSlots(rule, MON, 14);
    expect(slots).toHaveLength(2); // two Mondays in 14 days
    expect(new Date(slots[0]).getUTCDay()).toBe(1); // R4: Monday stays Monday
    expect(wallClock(slots[0])).toBe('17:00'); // R3: floating 17:00
  });

  it('handles multiple weekdays and stays sorted', () => {
    const rule: Recurrence = { weekdays: [1, 3], time: '09:30' }; // Mon + Wed
    const slots = recurringSlots(rule, MON, 7);
    expect(slots).toHaveLength(2);
    expect(slots[0] < slots[1]).toBe(true);
    expect(wallClock(slots[1])).toBe('09:30');
  });

  it('excludes invalid weekdays and clamps malformed time to 00:00', () => {
    const rule = { weekdays: [9, 1], time: 'nope' } as Recurrence;
    const slots = recurringSlots(rule, MON, 7);
    expect(slots).toHaveLength(1);
    expect(wallClock(slots[0])).toBe('00:00');
  });
});

// B1: per-membership recurrence — missingSlots keyed off one membership's
// existing session times; idempotent; a second schedule generates independently.
describe('missingSlots (B1)', () => {
  const rule: Recurrence = { weekdays: [1], time: '17:00' }; // Mondays 17:00

  it('generates one slot per matching weekday when nothing exists', () => {
    const slots = missingSlots(rule, [], MON, 14);
    expect(slots).toHaveLength(2); // two Mondays in 14 days
    expect(new Date(slots[0]).getUTCDay()).toBe(1);
  });

  it('is idempotent: re-feeding generated slots adds nothing', () => {
    const first = missingSlots(rule, [], MON, 14);
    expect(missingSlots(rule, first, MON, 14)).toEqual([]);
  });

  it('only fills the gap when some slots already exist', () => {
    const all = recurringSlots(rule, MON, 14);
    const gap = missingSlots(rule, [all[0]], MON, 14); // first Monday already scheduled
    expect(gap).toEqual([all[1]]);
  });

  it('a second membership schedule generates independently', () => {
    const a = missingSlots({ weekdays: [1], time: '17:00' }, [], MON, 7); // Mon
    const b = missingSlots({ weekdays: [3], time: '09:00' }, [], MON, 7); // Wed
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(new Date(a[0]).getUTCDay()).toBe(1);
    expect(new Date(b[0]).getUTCDay()).toBe(3);
  });
});

// M2 sectioning (PRD 0007 §5, T2/T4/T6).
describe('sectionSessions', () => {
  const rule: Recurrence = { weekdays: [1], time: '17:00' }; // Mondays 17:00
  const row = (over: Partial<Session> & { scheduled_at: string }): Session => ({
    id: over.scheduled_at, membership_id: 'm', is_adhoc: false, canceled: false,
    attendance_status: null, moved_from: null, created_at: over.scheduled_at, ...over,
  });

  it('dedups a real row over its virtual twin (T6)', () => {
    // Next Monday after MON is 2026-07-06; give it a real unmarked row.
    const twin = '2026-07-06T17:00:00.000Z';
    const now = new Date('2026-07-01T00:00:00Z'); // Wed, before that Monday
    const { next, upcoming } = sectionSessions(rule, [row({ scheduled_at: twin })], now);
    const at = [next, ...upcoming].filter((s): s is NonNullable<typeof s> => !!s)
      .filter((s) => s.scheduled_at === twin);
    expect(at).toHaveLength(1);
    expect(at[0].session).not.toBeNull(); // the real row, not the virtual
  });

  it('a real past unresolved row within grace is the editable Next (T3)', () => {
    const now = new Date('2026-07-06T20:00:00Z'); // 3h after the 17:00 slot (in grace)
    const rows = [row({ scheduled_at: '2026-07-06T17:00:00.000Z' })]; // real, unmarked
    const { next, nextEditable } = sectionSessions(rule, rows, now);
    expect(next?.scheduled_at).toBe('2026-07-06T17:00:00.000Z');
    expect(next?.session).not.toBeNull(); // the real row, not a virtual past slot
    expect(nextEditable).toBe(true);
  });

  it('a real unresolved row older than grace goes to History, not Next (T3d)', () => {
    const now = new Date('2026-07-07T09:00:00Z'); // 16h after the 07-06 slot (stale)
    const rows = [row({ scheduled_at: '2026-07-06T17:00:00.000Z' })]; // real, unmarked
    const { next, nextEditable, history } = sectionSessions(rule, rows, now);
    expect(next?.scheduled_at).toBe('2026-07-13T17:00:00.000Z'); // soonest future
    expect(nextEditable).toBe(false);
    expect(history.map((h) => h.scheduled_at)).toContain('2026-07-06T17:00:00.000Z');
  });

  it('virtual slots are future-only: no past awaiting slot conjured (T3b)', () => {
    // now = Tue after a Monday passed, but NO real row for it → nothing awaiting.
    const now = new Date('2026-07-07T09:00:00Z');
    const { next, nextEditable } = sectionSessions(rule, [], now);
    expect(next?.scheduled_at).toBe('2026-07-13T17:00:00.000Z'); // soonest FUTURE Monday
    expect(next?.session).toBeNull();
    expect(nextEditable).toBe(false); // display-only, nothing to mark
  });

  it('a just-passed virtual slot lingers as editable Next within the 12h grace (T3c)', () => {
    const now = new Date('2026-07-06T20:00:00Z'); // 3h after the 17:00 Monday slot
    const { next, nextEditable } = sectionSessions(rule, [], now);
    expect(next?.scheduled_at).toBe('2026-07-06T17:00:00.000Z');
    expect(next?.session).toBeNull(); // still virtual, materializes on mark
    expect(nextEditable).toBe(true);
  });

  it('no session yet → soonest upcoming, display-only (T4)', () => {
    const now = new Date('2026-07-03T09:00:00Z'); // Fri; next Monday 07-06 future
    const { next, nextEditable, upcoming } = sectionSessions(rule, [], now);
    expect(next?.scheduled_at).toBe('2026-07-06T17:00:00.000Z');
    expect(nextEditable).toBe(false);
    expect(upcoming[0].scheduled_at).toBe('2026-07-13T17:00:00.000Z');
  });

  it('a rescheduled row suppresses the virtual twin at its original slot', () => {
    const now = new Date('2026-07-03T09:00:00Z'); // Fri; Monday 07-06 slot is future
    // Row moved off the 07-06 17:00 Monday to Tuesday 07-07 15:00.
    const rows = [row({
      scheduled_at: '2026-07-07T15:00:00.000Z',
      moved_from: '2026-07-06T17:00:00.000Z',
    })];
    const { next, upcoming } = sectionSessions(rule, rows, now);
    const times = [next, ...upcoming].filter((s): s is NonNullable<typeof s> => !!s)
      .map((s) => s.scheduled_at);
    expect(times).toContain('2026-07-07T15:00:00.000Z'); // the moved row
    expect(times).not.toContain('2026-07-06T17:00:00.000Z'); // twin suppressed
  });

  it('History is resolved rows, newest first, and a marked Next drops out (T2/T5)', () => {
    const now = new Date('2026-07-14T09:00:00Z');
    const rows = [
      row({ scheduled_at: '2026-06-29T17:00:00.000Z', attendance_status: 'present' }),
      row({ scheduled_at: '2026-07-06T17:00:00.000Z', attendance_status: 'absent' }),
    ];
    const { history, next } = sectionSessions(rule, rows, now);
    expect(history.map((h) => h.scheduled_at)).toEqual([
      '2026-07-06T17:00:00.000Z', '2026-06-29T17:00:00.000Z', // newest first
    ]);
    // Marked Mondays gone from Next; 07-13 passed >12h ago unmaterialized so it's
    // lost too — the soonest future Monday 07-20 is now Next.
    expect(next?.scheduled_at).toBe('2026-07-20T17:00:00.000Z');
  });
});
