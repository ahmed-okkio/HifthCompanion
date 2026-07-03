import type { Recurrence } from '@/types';

// ---------------------------------------------------------------------------
// M3 recurrence — pure logic to materialize weekly-recurring session times.
// A session is identified by its scheduled_at instant; we compute which slots
// fall inside a rolling horizon and return the ones not already present so the
// caller can insert only the missing rows (idempotent generation).
// ---------------------------------------------------------------------------

/** "HH:MM" -> [hours, minutes]; returns [0,0] on malformed input. */
function parseTime(time: string): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!m) return [0, 0];
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const min = Math.min(59, Math.max(0, Number(m[2])));
  return [h, min];
}

/**
 * Slot instants for `rule` from `from` (inclusive) over `horizonDays`.
 * Times float as wall-clock (interpreted as-if-UTC), so a picked 17:00 stays
 * 17:00 regardless of host timezone; render sites use timeZone:'UTC'.
 * Returns sorted ascending ISO strings.
 */
export function recurringSlots(
  rule: Recurrence | null,
  from: Date,
  horizonDays = 28,
): string[] {
  if (!rule || rule.weekdays.length === 0) return [];
  const days = new Set(rule.weekdays.filter((d) => d >= 0 && d <= 6));
  if (days.size === 0) return [];
  const [h, min] = parseTime(rule.time);

  const out: string[] = [];
  const cursor = new Date(from);
  // UTC ops so the picked wall-clock floats (stored as-if-UTC), independent of
  // the host process timezone (this runs in the generateSessions server action).
  cursor.setUTCHours(0, 0, 0, 0);
  for (let i = 0; i < horizonDays; i++) {
    if (days.has(cursor.getUTCDay())) {
      const slot = new Date(cursor);
      slot.setUTCHours(h, min, 0, 0);
      if (slot.getTime() >= from.getTime()) out.push(slot.toISOString());
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

/**
 * Slots from `rule` over the horizon that aren't already present in `existing`
 * (a set of session `scheduled_at` ISO strings for ONE membership). Pure and
 * membership-agnostic: the caller passes that membership's existing times and
 * inserts the result under its membership_id (D4). Idempotent — feeding the
 * generated slots back as `existing` yields [].
 */
export function missingSlots(
  rule: Recurrence | null,
  existing: Iterable<string>,
  from: Date,
  horizonDays = 28,
): string[] {
  const have = new Set(existing);
  return recurringSlots(rule, from, horizonDays).filter((s) => !have.has(s));
}
