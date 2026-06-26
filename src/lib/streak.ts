import type { ProgressLog } from '@/types';

/**
 * Streak = consecutive days up to today (or the most recent log day) that have
 * at least one log, counted by log_date. Alive if the latest log is today or
 * yesterday; otherwise 0.
 */
export function computeStreak(logs: Pick<ProgressLog, 'log_date'>[]): number {
  if (logs.length === 0) return 0;
  const days = new Set(logs.map((l) => l.log_date));
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  if (!days.has(iso(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!days.has(iso(cursor))) return 0;
  }

  let streak = 0;
  while (days.has(iso(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
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
  today?: string,
): boolean {
  if (today === undefined) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    today = d.toISOString().slice(0, 10);
  }
  if (computeStreak(logs) < 1) return false;
  return !logs.some((l) => l.log_date === today);
}
