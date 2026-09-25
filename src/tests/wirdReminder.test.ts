import { describe, it, expect } from 'vitest';
import { localDate, addDays } from '@/lib/localDate';
import {
  localSlot,
  reminderDue,
  wirdsLeftToday,
  REMINDER_TIMES,
  formatReminderTime,
} from '@/lib/wirdReminder';

// 2026-07-01 23:30 UTC: already 2 July in Tokyo, still 1 July in New York.
const LATE_UTC = new Date('2026-07-01T23:30:00Z');

describe('localDate (D20 local-midnight day)', () => {
  it('uses the given zone, not UTC', () => {
    expect(localDate('UTC', LATE_UTC)).toBe('2026-07-01');
    expect(localDate('Asia/Tokyo', LATE_UTC)).toBe('2026-07-02');
    // 19:30 in New York: toISOString() would already say 2 July.
    expect(localDate('America/New_York', LATE_UTC)).toBe('2026-07-01');
  });

  it('falls back to UTC for an unknown zone', () => {
    expect(localDate('Not/AZone', LATE_UTC)).toBe('2026-07-01');
  });

  it('addDays crosses month and year ends', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('reminderDue', () => {
  // 17:07 UTC = 18:07 in London (BST) — inside the 18:00 slot.
  const tick = new Date('2026-07-01T17:07:00Z');

  it('matches the 15-minute slot in the user zone', () => {
    expect(localSlot('Europe/London', tick)).toBe('18:00');
    expect(reminderDue('Europe/London', '18:00:00', tick)).toBe(true);
    expect(reminderDue('Europe/London', '18:15:00', tick)).toBe(false);
  });

  it('fires an hour later for a zone one hour ahead', () => {
    expect(reminderDue('Europe/Paris', '18:00:00', tick)).toBe(false);
    expect(reminderDue('Europe/Paris', '18:00:00', new Date('2026-07-01T16:00:00Z'))).toBe(true);
  });

  it('handles half-hour zones (India +5:30)', () => {
    // 12:30 UTC = 18:00 IST.
    expect(reminderDue('Asia/Kolkata', '18:00:00', new Date('2026-07-01T12:30:00Z'))).toBe(true);
    expect(reminderDue('Asia/Kolkata', '18:00:00', new Date('2026-07-01T12:00:00Z'))).toBe(false);
  });

  it('never fires for an unknown zone', () => {
    expect(reminderDue('Not/AZone', '18:00:00', tick)).toBe(false);
  });
});

describe('wirdsLeftToday', () => {
  const daily = { pages_per_period: 1, period_days: 1, cycle_seq: 1 };

  it('counts wirds with no entry today', () => {
    const wirds = [{ id: 'a', ...daily }, { id: 'b', ...daily }];
    const entries = [{ wird_id: 'a', entry_date: '2026-07-01', cycle_seq: 1 }];
    expect(wirdsLeftToday(wirds, entries, '2026-07-01')).toBe(1);
    expect(wirdsLeftToday(wirds, entries, '2026-07-02')).toBe(2);
  });

  it('skips a wird whose portion today is 0 pages', () => {
    // 1 page every 2 days: day 1 = floor(0.5) − 0 = 0 pages, day 2 = 1 page.
    const slow = [{ id: 's', pages_per_period: 1, period_days: 2, cycle_seq: 1 }];
    expect(wirdsLeftToday(slow, [], '2026-07-01')).toBe(0);
    const oneDone = [{ wird_id: 's', entry_date: '2026-06-30', cycle_seq: 1 }];
    expect(wirdsLeftToday(slow, oneDone, '2026-07-01')).toBe(1);
  });

  it('is 0 with no wirds', () => {
    expect(wirdsLeftToday([], [], '2026-07-01')).toBe(0);
  });
});

describe('reminder times', () => {
  it('lists 96 quarter-hours from 00:00 to 23:45', () => {
    expect(REMINDER_TIMES).toHaveLength(96);
    expect(REMINDER_TIMES[0]).toBe('00:00');
    expect(REMINDER_TIMES[72]).toBe('18:00');
    expect(REMINDER_TIMES.at(-1)).toBe('23:45');
  });

  it('formats as the locale writes a time, ignoring the runtime zone', () => {
    expect(formatReminderTime('18:00:00', 'en-GB')).toBe('18:00');
    expect(formatReminderTime('18:15', 'en-US')).toMatch(/^6:15\s?PM$/);
  });
});
