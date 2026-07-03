import type { Homework } from '@/types';
import { SURAH_FIRST_PAGES, TOTAL_PAGES, TOTAL_SURAHS, getSurahName } from '@/lib/quran';

// Pure homework logic — no supabase import so B4 unit tests can import it freely.

export type HomeworkStatus = 'open' | 'completed' | 'missed';

/**
 * Derived homework status (D10). Status is never stored — computed from the
 * deadline and how many progress_log rows link to the prescription:
 *   - no deadline, or deadline today/future → 'open' (still submittable)
 *   - deadline past & ≥1 linked log            → 'completed'
 *   - deadline past & 0 linked logs            → 'missed'
 * `today` is a date-only "YYYY-MM-DD"; homework.deadline is the same shape.
 */
export function homeworkStatus(
  homework: Pick<Homework, 'deadline'>,
  linkedLogCount: number,
  today: string,
): HomeworkStatus {
  if (!homework.deadline || homework.deadline >= today) return 'open';
  return linkedLogCount >= 1 ? 'completed' : 'missed';
}

/**
 * Best-effort page bounds for a whole surah (H6). Surah S spans from its first
 * page to the page before the next surah's first page; the last surah ends 604.
 * Kept only for reader-linking / back-compat — grading is by surah/ayah, not page.
 */
export function wholeSurahPages(surah: number): [number, number] {
  const start = SURAH_FIRST_PAGES[surah];
  const end = surah >= TOTAL_SURAHS ? TOTAL_PAGES : SURAH_FIRST_PAGES[surah + 1] - 1;
  return [start, end];
}

/**
 * Group status = aggregate of its rows (H4): open until all entries completed.
 * Empty → 'completed' (never happens; groups always have ≥1 row).
 */
export function aggregateStatus(statuses: HomeworkStatus[]): HomeworkStatus {
  if (statuses.some((s) => s === 'open')) return 'open';
  if (statuses.every((s) => s === 'completed')) return 'completed';
  return 'missed';
}

export type HomeworkGroup = { key: string; items: Homework[] };

/**
 * Bucket rows into cards (H3): rows sharing a group_id render together; a legacy
 * null-group_id row (H5) is its own solo card. Input order is preserved.
 */
export function groupHomework(items: Homework[]): HomeworkGroup[] {
  const byKey = new Map<string, Homework[]>();
  const order: string[] = [];
  for (const h of items) {
    const key = h.group_id ?? `solo:${h.id}`;
    if (!byKey.has(key)) { byKey.set(key, []); order.push(key); }
    byKey.get(key)!.push(h);
  }
  return order.map((key) => ({ key, items: byKey.get(key)! }));
}

/**
 * Display label for one homework row (H3): surah name + ayah range, e.g.
 * "Al-Baqara 1–20", or just the name for a whole surah. Null for a legacy
 * page-only row (no surah) — caller falls back to a page range.
 */
export function homeworkEntryLabel(
  h: Pick<Homework, 'surah' | 'ayah_start' | 'ayah_end'>,
  locale: 'en' | 'ar' = 'en',
): string | null {
  if (!h.surah) return null;
  const name = getSurahName(h.surah, locale);
  if (h.ayah_start == null) return name;
  const end = h.ayah_end && h.ayah_end !== h.ayah_start ? `–${h.ayah_end}` : '';
  return `${name} ${h.ayah_start}${end}`;
}
