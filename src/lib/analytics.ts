import type { Attendance, Circle, LogRole, LogType, MemorizedRange, Polarity, ProgressLog } from '@/types';
import {
  getJuzForPage, getSurahForPage, getPageForAyah, getAyahsOnPage, TOTAL_JUZ, TOTAL_PAGES,
} from '@/lib/quran';

// ---------------------------------------------------------------------------
// analytics — pure functions over a student's logs + circle config.
// Role is derived directly from the fixed log_type enum (D8 hardcoded map);
// teacher_status polarity is still resolved through the per-circle config (D14).
// ---------------------------------------------------------------------------

/** Fixed log_type → role map (D8). No `read` role remains. */
const TYPE_ROLE: Record<LogType, LogRole> = {
  memorization: 'memorize',
  general_revision: 'revise',
  targeted_revision: 'revise',
};

/** label -> polarity, from circle.teacher_statuses. */
export function teacherPolarityMap(circle: Pick<Circle, 'teacher_statuses'>): Map<string, Polarity> {
  return new Map(circle.teacher_statuses.map((s) => [s.label, s.polarity]));
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Pages touched by a log range, clamped to 1–604. */
function pagesOf(log: Pick<ProgressLog, 'page_start' | 'page_end'>): number[] {
  const lo = Math.max(1, Math.min(log.page_start, log.page_end));
  const hi = Math.min(TOTAL_PAGES, Math.max(log.page_start, log.page_end));
  const out: number[] = [];
  for (let p = lo; p <= hi; p++) out.push(p);
  return out;
}

// --- M2-1: calendar consistency heatmap --------------------------------------

export type HeatmapDay = { date: string; count: number };

/**
 * Logs-per-day for the last `days` days ending today (inclusive), oldest first.
 * Counts logs by log_date so backdated catch-up entries land on the right day.
 */
export function buildHeatmap(
  logs: Pick<ProgressLog, 'log_date'>[],
  days = 119, // 17 weeks * 7 — a tidy GitHub-style grid
): HeatmapDay[] {
  const counts = new Map<string, number>();
  for (const l of logs) counts.set(l.log_date, (counts.get(l.log_date) ?? 0) + 1);

  const out: HeatmapDay[] = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() - (days - 1));
  for (let i = 0; i < days; i++) {
    const date = iso(cursor);
    out.push({ date, count: counts.get(date) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// --- M2-2: cumulative pages + juz totals -------------------------------------

export type Totals = { pages: number; juz: number; surahs: number; logs: number };

/** Distinct pages, distinct juz, and distinct surahs covered across all logs. */
export function cumulativeTotals(logs: Pick<ProgressLog, 'page_start' | 'page_end'>[]): Totals {
  const pages = new Set<number>();
  for (const l of logs) for (const p of pagesOf(l)) pages.add(p);
  const juz = new Set<number>();
  const surahs = new Set<number>();
  for (const p of pages) { juz.add(getJuzForPage(p)); surahs.add(getSurahForPage(p)); }
  return { pages: pages.size, juz: juz.size, surahs: surahs.size, logs: logs.length };
}

// --- Hifth profile: log -> memorized ranges, and totals over ranges ----------

/**
 * A memorization log as ayah ranges to credit into user_hifth. An explicit
 * surah+ayah scope maps 1:1; a page-only log is decomposed via the page↔ayah
 * map, one range per surah spanned (min..max ayah on the covered pages).
 * ponytail: page-only ranges clip at page edges, so a whole-surah submission
 * logged by pages credits only the ayahs actually on those pages — good enough;
 * tighten only if partial-surah edges cause visible under-credit.
 */
export function logToMemorizedRanges(
  log: Pick<ProgressLog, 'page_start' | 'page_end' | 'surah' | 'ayah_start' | 'ayah_end'>,
): MemorizedRange[] {
  if (log.surah && log.ayah_start != null && log.ayah_end != null) {
    return [{ surah: log.surah, from: Math.min(log.ayah_start, log.ayah_end), to: Math.max(log.ayah_start, log.ayah_end) }];
  }
  const lo = Math.max(1, Math.min(log.page_start, log.page_end));
  const hi = Math.min(TOTAL_PAGES, Math.max(log.page_start, log.page_end));
  const bounds = new Map<number, { from: number; to: number }>();
  for (let p = lo; p <= hi; p++) {
    for (const { surah, ayah } of getAyahsOnPage(p)) {
      const b = bounds.get(surah);
      if (!b) bounds.set(surah, { from: ayah, to: ayah });
      else { b.from = Math.min(b.from, ayah); b.to = Math.max(b.to, ayah); }
    }
  }
  return [...bounds.entries()].map(([surah, b]) => ({ surah, from: b.from, to: b.to }));
}

/** Distinct juz + surahs covered by a set of memorized ayah ranges. */
export function rangesTotals(ranges: MemorizedRange[]): { juz: number; surahs: number } {
  const surahs = new Set<number>();
  const juz = new Set<number>();
  for (const r of ranges) {
    surahs.add(r.surah);
    const p0 = getPageForAyah(r.surah, Math.min(r.from, r.to));
    const p1 = getPageForAyah(r.surah, Math.max(r.from, r.to));
    for (let p = Math.min(p0, p1); p <= Math.max(p0, p1); p++) juz.add(getJuzForPage(p));
  }
  return { juz: juz.size, surahs: surahs.size };
}

// --- M2-3: weakest-surah ------------------------------------------------------

export type SurahScore = { surah: number; graded: number; negative: number; ratio: number };

/** Surahs spanned by a log: explicit surah field, else derived from page range. */
function surahsOf(log: ProgressLog): number[] {
  if (log.surah) return [log.surah];
  const lo = getSurahForPage(Math.min(log.page_start, log.page_end));
  const hi = getSurahForPage(Math.max(log.page_start, log.page_end));
  const out: number[] = [];
  for (let s = lo; s <= hi; s++) out.push(s);
  return out;
}

/**
 * Per-surah weakness = negative-polarity teacher_status ratio over graded logs.
 * Only reviewed logs with a teacher_status count. Sorted weakest first
 * (highest ratio, then most graded), surahs with no graded logs excluded.
 */
export function weakestSurahs(logs: ProgressLog[], circle: Pick<Circle, 'teacher_statuses'>): SurahScore[] {
  const pol = teacherPolarityMap(circle);
  const graded = new Map<number, number>();
  const negative = new Map<number, number>();

  for (const l of logs) {
    if (!l.reviewed_at || !l.teacher_status) continue;
    const isNeg = pol.get(l.teacher_status) === 'negative';
    for (const s of surahsOf(l)) {
      graded.set(s, (graded.get(s) ?? 0) + 1);
      if (isNeg) negative.set(s, (negative.get(s) ?? 0) + 1);
    }
  }

  const scores: SurahScore[] = [];
  for (const [surah, g] of graded) {
    const neg = negative.get(surah) ?? 0;
    scores.push({ surah, graded: g, negative: neg, ratio: neg / g });
  }
  return scores.sort((a, b) => b.ratio - a.ratio || b.graded - a.graded || a.surah - b.surah);
}

// --- M2-4: Mushaf coverage map ------------------------------------------------

export type PageCoverage = { memorized: boolean; lastRevised: string | null };

/**
 * Per-page coverage: role=memorize logs paint `memorized`; role=revise logs
 * track the most recent revision date (recency layer). Role is derived from the
 * fixed log_type enum (D8) — no circle config needed.
 * Returns a 1..604 array (index 0 unused) for cheap lookup in the grid.
 */
export function coverageMap(logs: ProgressLog[]): PageCoverage[] {
  const map: PageCoverage[] = Array.from({ length: TOTAL_PAGES + 1 }, () => ({
    memorized: false,
    lastRevised: null as string | null,
  }));

  for (const l of logs) {
    const role = TYPE_ROLE[l.log_type];
    if (role !== 'memorize' && role !== 'revise') continue;
    for (const p of pagesOf(l)) {
      if (role === 'memorize') map[p].memorized = true;
      else if (!map[p].lastRevised || l.log_date > map[p].lastRevised!) map[p].lastRevised = l.log_date;
    }
  }
  return map;
}

// --- M2-5: teacher roll-up ----------------------------------------------------

export type StudentRollup = {
  membershipId: string;
  totals: Totals;
  pending: number; // submitted, not yet reviewed
};

/** Per-student summary for a teacher's roll-up view. */
export function rollup(byMembership: Map<string, ProgressLog[]>): StudentRollup[] {
  const out: StudentRollup[] = [];
  for (const [membershipId, logs] of byMembership) {
    const pending = logs.filter((l) => !l.reviewed_at).length;
    out.push({ membershipId, totals: cumulativeTotals(logs), pending });
  }
  return out.sort((a, b) => b.totals.pages - a.totals.pages);
}

// --- M3-4: attendance analytics ----------------------------------------------

export type AttendanceStats = {
  marked: number; // sessions with an attendance row
  attended: number; // present + late
  absent: number;
  excused: number;
  rate: number; // attended / (marked - excused), 0 when denominator is 0
};

/**
 * Attendance summary for one student's rows. `excused` is removed from the
 * denominator (a justified absence shouldn't lower the rate); `late` counts as
 * attended. Rate is 0 when there is nothing countable.
 */
export function attendanceStats(rows: Pick<Attendance, 'status'>[]): AttendanceStats {
  let attended = 0, absent = 0, excused = 0;
  for (const r of rows) {
    if (r.status === 'present' || r.status === 'late') attended++;
    else if (r.status === 'absent') absent++;
    else if (r.status === 'excused') excused++;
  }
  const marked = rows.length;
  const denom = marked - excused;
  return { marked, attended, absent, excused, rate: denom > 0 ? attended / denom : 0 };
}

export { TOTAL_JUZ };
