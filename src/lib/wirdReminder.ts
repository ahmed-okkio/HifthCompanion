// ---------------------------------------------------------------------------
// 0016 daily wird reminder — who is due, and how many wirds they have left.
// Pure, no I/O; the cron route (src/app/api/cron/wird-reminder/route.ts) feeds
// it rows. Kept here so the timezone and "left today" rules are unit-testable.
// ---------------------------------------------------------------------------

import { dailyRate, portionSize } from '@/lib/wirdRate';

/** The cron ticks every 15 minutes; each tick owns one 15-minute slot. */
export const SLOT_MINUTES = 15;

/** Local 'HH:MM' of `now` in `timeZone`, floored to its 15-minute slot. Null for an unknown zone. */
export function localSlot(timeZone: string, now: Date): string | null {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', {
      timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now);
  } catch {
    return null;
  }
  const hour = parts.find((p) => p.type === 'hour')!.value;
  const minute = Number(parts.find((p) => p.type === 'minute')!.value);
  const slot = Math.floor(minute / SLOT_MINUTES) * SLOT_MINUTES;
  return `${hour}:${String(slot).padStart(2, '0')}`;
}

/**
 * Whether a reminder set for `reminderTime` (Postgres `time`, 'HH:MM[:SS]') is
 * due on the tick at `now`, in `timeZone`. A tick that runs a few minutes late
 * still lands in the right slot; one skipped entirely means no reminder that day.
 */
export function reminderDue(timeZone: string, reminderTime: string, now: Date): boolean {
  return localSlot(timeZone, now) === reminderTime.slice(0, 5);
}

export interface ReminderWird {
  id: string;
  pages_per_period: number;
  period_days: number;
  cycle_seq: number;
}

export interface ReminderEntry {
  wird_id: string;
  entry_date: string;
  cycle_seq: number;
}

/**
 * How many of a user's live wirds are still waiting today: no entry dated
 * `today` (their local date, same rule as the service's done_today), and a
 * non-empty portion. A slow rate (under a page a day) has 0-page days — nothing
 * to recite, so nothing to remind about. Portion size mirrors listWirds:
 * day n = entries in the current cycle + 1.
 */
export function wirdsLeftToday(
  wirds: ReminderWird[],
  entries: ReminderEntry[],
  today: string,
): number {
  let left = 0;
  for (const w of wirds) {
    const mine = entries.filter((e) => e.wird_id === w.id);
    if (mine.some((e) => e.entry_date === today)) continue;
    const n = mine.filter((e) => e.cycle_seq === w.cycle_seq).length + 1;
    if (portionSize(n, dailyRate(w.pages_per_period, w.period_days)) > 0) left += 1;
  }
  return left;
}

/** The default reminder, matching the column default. */
export const DEFAULT_REMINDER = '18:00';

/** Every settable time, 'HH:MM' — 00:00 to 23:45 in 15-minute steps (96). */
export const REMINDER_TIMES: string[] = Array.from({ length: (24 * 60) / SLOT_MINUTES }, (_, i) => {
  const m = i * SLOT_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
});

/** 'HH:MM[:SS]' → '6:00 pm' / '18:00' / '٦:٠٠ م', as the locale writes a time of day. */
export function formatReminderTime(time: string, locale: string): string {
  const [h, m] = time.split(':').map(Number);
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })
    .format(new Date(Date.UTC(1970, 0, 1, h, m)));
}
