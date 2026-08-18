/**
 * Minimal iCalendar (RFC 5545 / 5546) builder for the calendar invites that
 * ride along with session emails.
 *
 * ponytail: hand-rolled — the surface we need is UID / DTSTART / RDATE /
 * RECURRENCE-ID / ORGANIZER / ATTENDEE and nothing else, which is smaller than
 * the config of any ics library. No RRULE and no VTIMEZONE: occurrences are
 * emitted as an explicit RDATE list of UTC instants computed by the app's own
 * DST-aware `recurringSlots`, so the calendar can never drift from the session
 * rows the way a UTC-anchored FREQ=WEEKLY rule would.
 */

export interface IcsEvent {
  /** Stable id. Same uid + higher SEQUENCE = an update to what the client holds. */
  uid: string;
  /** ISO instant of the (first) occurrence. */
  start: string;
  summary: string;
  description?: string;
  /** ponytail: no duration column on `session`; 60 min is the lesson length. */
  minutes?: number;
  /** Further occurrence instants of the same series (RDATE). */
  rdates?: string[];
  /**
   * The original series instant this component overrides. Set it to move,
   * cancel or retitle ONE occurrence of a series without touching the rest.
   */
  recurrenceId?: string;
  /** Defaults from `method`; set explicitly to cancel a single occurrence. */
  status?: 'CONFIRMED' | 'CANCELLED';
}

export type IcsMethod = 'REQUEST' | 'CANCEL';

export interface IcsOrganizer {
  /** Must stay byte-identical across a series and every later override, or
   *  clients treat the update as a foreign event and ignore it. */
  email: string;
  name?: string;
}

const DEFAULT_MINUTES = 60;

/** RFC 5545 UTC form: 20260817T170000Z. */
function stamp(value: Date): string {
  return value.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function stampIso(value: string): string | null {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : stamp(d);
}

/** TEXT values escape backslash, semicolon, comma and newline. */
function esc(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** Param values (CN) can't carry these at all; drop rather than escape. */
function escParam(value: string): string {
  return value.replace(/[";:,\r\n]/g, ' ').trim();
}

/**
 * RFC 5545 caps a line at 75 octets; longer ones fold onto a continuation line
 * beginning with a space. Not optional here — a two-year RDATE list is a single
 * ~3KB line, and Arabic summaries are multi-byte, so folding counts octets and
 * never splits a code point.
 */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    // Continuation lines spend one octet on their leading space.
    const limit = parts.length === 0 ? 75 : 74;
    if (bytes + size > limit) {
      parts.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += size;
  }
  if (cur) parts.push(cur);
  return parts.join('\r\n ');
}

/** 0=Sunday..6=Saturday (the `Recurrence.weekdays` convention) → BYDAY codes. */
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

/**
 * ponytail: unused by the invite path (we emit RDATE lists, not rules) — kept
 * because it is the one piece worth reaching for if a client ever needs a real
 * recurrence rule.
 */
export function weeklyRrule(weekdays: number[]): string | undefined {
  const days = weekdays.filter((d) => d >= 0 && d <= 6).map((d) => BYDAY[d]);
  return days.length > 0 ? `FREQ=WEEKLY;BYDAY=${days.join(',')}` : undefined;
}

/**
 * One VCALENDAR holding every event. METHOD:REQUEST adds or updates,
 * METHOD:CANCEL withdraws; clients key off UID, so a CANCEL must reuse the
 * REQUEST's uid — and a CANCEL carrying RECURRENCE-ID withdraws only that one
 * occurrence rather than the whole series (RFC 5546).
 */
export function buildIcs(
  events: IcsEvent[],
  method: IcsMethod,
  attendee: string,
  organizer: IcsOrganizer,
): string {
  // Monotonic: any later mail for the same UID supersedes the earlier one.
  // A client ignores an update whose SEQUENCE is not higher than what it holds.
  const sequence = Math.floor(Date.now() / 1000);
  const now = stamp(new Date());
  const org = organizer.name
    ? `ORGANIZER;CN=${escParam(organizer.name)}:mailto:${organizer.email}`
    : `ORGANIZER:mailto:${organizer.email}`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Hifth Companion//EN',
    `METHOD:${method}`,
    'CALSCALE:GREGORIAN',
  ];

  for (const ev of events) {
    const start = new Date(ev.start);
    if (Number.isNaN(start.getTime())) continue;
    const end = new Date(start.getTime() + (ev.minutes ?? DEFAULT_MINUTES) * 60_000);
    const rdates = (ev.rdates ?? [])
      .map(stampIso)
      .filter((s): s is string => s !== null);
    const recurrenceId = ev.recurrenceId ? stampIso(ev.recurrenceId) : null;

    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      ...(recurrenceId ? [`RECURRENCE-ID:${recurrenceId}`] : []),
      // An override of a single occurrence must never carry the series' dates.
      ...(rdates.length > 0 && !recurrenceId ? [`RDATE:${rdates.join(',')}`] : []),
      `SEQUENCE:${sequence}`,
      `SUMMARY:${esc(ev.summary)}`,
      ...(ev.description ? [`DESCRIPTION:${esc(ev.description)}`] : []),
      org,
      // RSVP=FALSE: the organizer mailbox is a send-only app account, so asking
      // for a reply nobody reads would strand the student's answer. The event
      // still lands on the calendar as accepted.
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=FALSE:mailto:${attendee}`,
      `STATUS:${ev.status ?? (method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED')}`,
      'END:VEVENT',
    );
  }

  lines.push('END:VCALENDAR');
  return `${lines.map(fold).join('\r\n')}\r\n`;
}
