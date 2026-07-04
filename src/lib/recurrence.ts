import type { Recurrence, Session } from '@/types';

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

// ---------------------------------------------------------------------------
// M2 sectioning (PRD 0007 §5) — derive Next / Upcoming / History from the rule
// plus whatever real rows exist, dedup by scheduled_at (real wins). Pure so it
// runs client-side and in unit tests.
// ---------------------------------------------------------------------------

/** A slot in a section: virtual when `session` is null, else a materialized row. */
export interface SessionSlot {
  scheduled_at: string;
  session: Session | null;
}

export interface SectionedSessions {
  /** Most-recent past-or-now unresolved slot, else soonest upcoming (display-only). */
  next: SessionSlot | null;
  /** Whether Next accepts attendance (false = the display-only soonest-upcoming case). */
  nextEditable: boolean;
  upcoming: SessionSlot[];
  history: SessionSlot[];
}

/**
 * "Now" in the app's floating frame: session times are stored as wall-clock
 * as-if-UTC (a picked 17:00 → `...T17:00:00Z`, rendered with timeZone:'UTC'), so
 * to compare past/future against them, `now` must be shifted into that same
 * frame — its UTC fields set to the viewer's local wall clock. Without this a
 * 2:00pm slot reads as "future" to a UTC+n viewer whose local clock is 2:44pm.
 */
export function floatingNow(d: Date = new Date()): Date {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000);
}

/** A row is "resolved" (belongs in History) once it carries attendance or a cancel. */
function isResolved(s: Session): boolean {
  return s.attendance_status !== null || s.canceled;
}

/**
 * Split `rows` + rule-derived virtual slots into Next / Upcoming / History.
 * - Virtual slots span [now - lookbackDays, now + horizonDays] so a just-passed
 *   slot surfaces as Next before anyone materializes it.
 * - Dedup by scheduled_at: a real row drops its virtual twin (T6).
 * - Next = most-recent past-or-now UNRESOLVED slot (editable). If none, the
 *   soonest upcoming slot is shown display-only (T4). Upcoming = the rest.
 * - History = resolved rows (attendance set or canceled), newest first (T2).
 */
export function sectionSessions(
  rule: Recurrence | null,
  rows: Session[],
  now: Date,
  horizonDays = 28,
): SectionedSessions {
  const nowMs = now.getTime();
  // Key by instant (epoch ms), not the raw string: a materialized row comes back
  // from Postgres in a different ISO format than recurringSlots emits (e.g.
  // `+00:00` vs `.000Z`), so a string compare would miss the dedup and show the
  // slot as both a virtual "awaiting" AND its resolved history row (T6).
  const byTime = new Map(rows.map((r) => [new Date(r.scheduled_at).getTime(), r]));

  // Virtual slots reach back only GRACE_MS before now: a just-passed slot stays
  // markable as "awaiting" for a short grace window, then vanishes forever unless
  // the teacher materialized it by marking attendance. No deep past awaiting slots.
  const GRACE_MS = 12 * 60 * 60 * 1000; // 12h
  const windowStart = new Date(nowMs - GRACE_MS);
  const virtual = recurringSlots(rule, windowStart, horizonDays + 1)
    .filter((iso) => !byTime.has(new Date(iso).getTime())) // real row wins the dedup (T6)
    .map((iso) => ({ scheduled_at: iso, session: null }));

  const graceStartMs = nowMs - GRACE_MS;
  // Real unresolved rows older than the grace window are "stale" — a session that
  // came and went unmarked. They drop to History (read-only), never lingering as
  // an editable "awaiting" slot forever (same cutoff as virtual slots).
  const realUnresolved = rows
    .filter((r) => !isResolved(r))
    .map((r) => ({ scheduled_at: r.scheduled_at, session: r }));
  const staleUnresolved = realUnresolved.filter(
    (s) => new Date(s.scheduled_at).getTime() < graceStartMs,
  );

  const active = [...virtual, ...realUnresolved.filter(
    (s) => new Date(s.scheduled_at).getTime() >= graceStartMs,
  )].sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));

  const pastOrNow = active.filter((s) => new Date(s.scheduled_at).getTime() <= nowMs);
  const future = active.filter((s) => new Date(s.scheduled_at).getTime() > nowMs);

  let next: SessionSlot | null = null;
  let nextEditable = false;
  let upcoming: SessionSlot[] = future;
  if (pastOrNow.length) {
    next = pastOrNow[pastOrNow.length - 1]; // most recent at-or-before now
    nextEditable = true;
  } else if (future.length) {
    next = future[0]; // nothing to mark yet → soonest upcoming, display-only (T4)
    upcoming = future.slice(1);
  }

  const history = [
    ...rows.filter(isResolved).map((r) => ({ scheduled_at: r.scheduled_at, session: r })),
    ...staleUnresolved, // unmarked-but-past sessions belong in the record too
  ].sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at)); // newest first (T2)

  return { next, nextEditable, upcoming, history };
}
