/**
 * The calendar date (YYYY-MM-DD) of `now` in `timeZone` — a local-midnight day
 * (PRD 0015 D20). Omit the zone for the runtime's own (the browser's, on the
 * client). An unknown zone falls back to UTC rather than throwing.
 *
 * Replaces `toISOString().slice(0, 10)`, which is the UTC date: after 8 pm in
 * New York it is already tomorrow, so a Done landed on the wrong day.
 */
export function localDate(timeZone?: string | null, now: Date = new Date()): string {
  try {
    return now.toLocaleDateString('en-CA', { timeZone: timeZone ?? undefined });
  } catch {
    return now.toLocaleDateString('en-CA', { timeZone: 'UTC' });
  }
}

/** `iso` shifted by `days` calendar days. Pure date arithmetic, no zone involved. */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
