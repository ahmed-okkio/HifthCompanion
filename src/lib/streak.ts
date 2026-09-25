import type { ProgressLog } from '@/types';
import { addDays, localDate } from '@/lib/localDate';

/**
 * Merge progress logs and wird entries into one dated activity stream for the
 * streak (E1). Keeps `computeStreak`/`isStreakAtRisk` on their `{ log_date }[]`
 * shape — the merge happens here at the call site, not inside them. A day with
 * only a wird entry, only a log, or both counts once (E2): computeStreak
 * already dedupes by date. `wirdEntryDates` are `wird_entry.entry_date` values.
 */
export function mergeActivity(
  logs: Pick<ProgressLog, 'log_date'>[],
  wirdEntryDates: string[],
): { log_date: string }[] {
  return [...logs, ...wirdEntryDates.map((log_date) => ({ log_date }))];
}

/**
 * Streak = consecutive days up to today (or the most recent log day) that have
 * at least one log, counted by log_date. Alive if the latest log is today or
 * yesterday; otherwise 0. `today` defaults to the runtime's local date (D20).
 */
export function computeStreak(
  logs: Pick<ProgressLog, 'log_date'>[],
  today: string = localDate(),
): number {
  if (logs.length === 0) return 0;
  const days = new Set(logs.map((l) => l.log_date));

  let cursor = today;
  if (!days.has(cursor)) {
    cursor = addDays(cursor, -1);
    if (!days.has(cursor)) return 0;
  }

  let streak = 0;
  while (days.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

/**
 * A streak is "at risk" when it is still alive (>= 1) but has no log for today —
 * i.e. it will break unless the student logs before the day ends. `today` is an
 * ISO date (YYYY-MM-DD); defaults to the current local day.
 */
export function isStreakAtRisk(
  logs: Pick<ProgressLog, 'log_date'>[],
  today: string = localDate(),
): boolean {
  if (computeStreak(logs, today) < 1) return false;
  return !logs.some((l) => l.log_date === today);
}
