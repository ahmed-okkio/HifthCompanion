import { describe, expect, it } from 'vitest';

import { buildIcs, weeklyRrule } from '@/lib/email/ics';

const ORG = { email: 'app@example.com', name: 'Sh. Bilal' };

/** Undo RFC 5545 line folding so assertions can look at logical lines. */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, '');
}

describe('ics', () => {
  it('emits a UTC VEVENT with attendee, organizer CN and a default 60-minute end', () => {
    const ics = unfold(
      buildIcs(
        [{ uid: 'u1', start: '2026-08-17T17:00:00.000Z', summary: 'Hifth session; and, more' }],
        'REQUEST',
        'student@example.com',
        ORG,
      ),
    );
    expect(ics).toContain('METHOD:REQUEST');
    expect(ics).toContain('DTSTART:20260817T170000Z');
    expect(ics).toContain('DTEND:20260817T180000Z');
    expect(ics).toContain('SUMMARY:Hifth session\\; and\\, more');
    expect(ics).toContain('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:student@example.com');
    expect(ics).toContain('ORGANIZER;CN=Sh. Bilal:mailto:app@example.com');
    expect(ics).toContain('STATUS:CONFIRMED');
  });

  it('lists extra occurrences as RDATE rather than a UTC-anchored RRULE', () => {
    const ics = unfold(
      buildIcs(
        [
          {
            uid: 'series-1',
            start: '2026-08-17T17:00:00Z',
            rdates: ['2026-08-24T17:00:00Z', '2026-08-31T16:00:00Z'],
            summary: 'x',
          },
        ],
        'REQUEST',
        'a@b.c',
        ORG,
      ),
    );
    expect(ics).toContain('RDATE:20260824T170000Z,20260831T160000Z');
    expect(ics).not.toContain('RRULE');
  });

  it('cancels one occurrence via RECURRENCE-ID and drops the series dates', () => {
    const ics = unfold(
      buildIcs(
        [
          {
            uid: 'series-1',
            start: '2026-08-24T17:00:00Z',
            recurrenceId: '2026-08-24T17:00:00Z',
            rdates: ['2026-08-31T17:00:00Z'],
            summary: 'x',
            status: 'CANCELLED',
          },
        ],
        'CANCEL',
        'a@b.c',
        ORG,
      ),
    );
    expect(ics).toContain('METHOD:CANCEL');
    expect(ics).toContain('UID:series-1');
    expect(ics).toContain('RECURRENCE-ID:20260824T170000Z');
    expect(ics).toContain('STATUS:CANCELLED');
    // An override must not restate the whole series, or clients rebuild it.
    expect(ics).not.toContain('RDATE');
  });

  it('folds long lines at 75 octets without splitting a multi-byte character', () => {
    const rdates = Array.from({ length: 60 }, (_, i) =>
      new Date(Date.UTC(2026, 7, 17 + i * 7, 17)).toISOString(),
    );
    const raw = buildIcs(
      [{ uid: 'u1', start: rdates[0], rdates: rdates.slice(1), summary: 'جلسة حفظ '.repeat(12) }],
      'REQUEST',
      'a@b.c',
      ORG,
    );
    const enc = new TextEncoder();
    for (const line of raw.split('\r\n')) {
      expect(enc.encode(line).length).toBeLessThanOrEqual(75);
    }
    // Folding is reversible — no character was lost or split.
    expect(unfold(raw)).toContain('جلسة حفظ');
    expect(unfold(raw)).toContain(`RDATE:${rdates.slice(1).map((d) => d.replace(/[-:]/g, '').replace(/\.\d{3}/, '')).join(',')}`);
  });

  it('skips unparseable starts instead of emitting a broken VEVENT', () => {
    const ics = buildIcs([{ uid: 'u1', start: 'soon', summary: 'x' }], 'REQUEST', 'a@b.c', ORG);
    expect(ics).not.toContain('BEGIN:VEVENT');
  });

  it('maps 0=Sunday weekdays to BYDAY, and no weekdays to no rule', () => {
    expect(weeklyRrule([1, 3])).toBe('FREQ=WEEKLY;BYDAY=MO,WE');
    expect(weeklyRrule([0, 6])).toBe('FREQ=WEEKLY;BYDAY=SU,SA');
    expect(weeklyRrule([])).toBeUndefined();
  });
});
