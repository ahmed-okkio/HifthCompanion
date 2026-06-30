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
 * Times are interpreted in the host's local timezone — fine for a single-class
 * teacher; cross-tz handling is deferred. Returns sorted ascending ISO strings.
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
  cursor.setHours(0, 0, 0, 0);
  for (let i = 0; i < horizonDays; i++) {
    if (days.has(cursor.getDay())) {
      const slot = new Date(cursor);
      slot.setHours(h, min, 0, 0);
      if (slot.getTime() >= from.getTime()) out.push(slot.toISOString());
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}
