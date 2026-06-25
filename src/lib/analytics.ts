import type { Halaqah, LogRole, Polarity, ProgressLog } from '@/types';
import { getJuzForPage, getSurahForPage, TOTAL_JUZ, TOTAL_PAGES } from '@/lib/quran';

// ---------------------------------------------------------------------------
// M2 analytics — pure functions over a student's logs + halaqah config.
// Logs store free-text log_type / teacher_status labels; role and polarity are
// resolved through the halaqah config maps below.
// ---------------------------------------------------------------------------

/** label -> role, from halaqah.log_types. */
export function roleMap(halaqah: Pick<Halaqah, 'log_types'>): Map<string, LogRole> {
  return new Map(halaqah.log_types.map((l) => [l.label, l.role]));
}

/** label -> polarity, from halaqah.teacher_statuses. */
export function teacherPolarityMap(halaqah: Pick<Halaqah, 'teacher_statuses'>): Map<string, Polarity> {
  return new Map(halaqah.teacher_statuses.map((s) => [s.label, s.polarity]));
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

export type Totals = { pages: number; juz: number; logs: number };

/** Distinct pages and distinct juz covered across all logs. */
export function cumulativeTotals(logs: Pick<ProgressLog, 'page_start' | 'page_end'>[]): Totals {
  const pages = new Set<number>();
  for (const l of logs) for (const p of pagesOf(l)) pages.add(p);
  const juz = new Set<number>();
  for (const p of pages) juz.add(getJuzForPage(p));
  return { pages: pages.size, juz: juz.size, logs: logs.length };
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
export function weakestSurahs(logs: ProgressLog[], halaqah: Pick<Halaqah, 'teacher_statuses'>): SurahScore[] {
  const pol = teacherPolarityMap(halaqah);
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
 * track the most recent revision date (recency layer); role=read excluded.
 * Returns a 1..604 array (index 0 unused) for cheap lookup in the grid.
 */
export function coverageMap(logs: ProgressLog[], halaqah: Pick<Halaqah, 'log_types'>): PageCoverage[] {
  const roles = roleMap(halaqah);
  const map: PageCoverage[] = Array.from({ length: TOTAL_PAGES + 1 }, () => ({
    memorized: false,
    lastRevised: null as string | null,
  }));

  for (const l of logs) {
    const role = roles.get(l.log_type);
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

export { TOTAL_JUZ };
