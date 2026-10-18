import type { SupabaseClient } from '@supabase/supabase-js';
import { dailyRate, portionSize, orderWirdViews, spanPages, coveredCount } from '@/lib/wirdRate';
import { getPageForAyah } from '@/lib/quran';
import { localDate } from '@/lib/localDate';
import type { Wird, WirdEntry, MemorizedRange } from '@/types';

// Wird reads, client-agnostic: take any Supabase client, so the browser (PRD 0016
// E1, RLS boundary) and the server actions in services/wird.ts share one copy.

/** A wird enriched with everything the daily screen needs, computed here (F1). */
export interface WirdView extends Wird {
  /** Next page to recite in the current pass (D1), clamped to cycle_page_end. */
  position: number;
  /** Today's portion, the page range a single Done would write (D4). */
  portion_start: number;
  portion_end: number;
  /** An entry dated today already exists for this wird (D3/F5). */
  done_today: boolean;
  /** Whole days since the most recent entry (any cycle); null if never done. */
  days_since_last_done: number | null;
  /** Pages left in the current pass (H11); 0 in the D9-clamp case. */
  pages_remaining: number;
  /** Total pages in the current pass (gap-skipping for memorized scope). */
  pass_length: number;
  /** Where the portion after the next Done begins: `position` once done today,
      else the page after today's portion (the live scope start on a wrap). Known
      up front so the UI never waits on a refresh to show it. */
  next_position: number;
  /** The pen editor's page lists: this pass in order (the wrapped pass once
      complete), and the pass after it (live scope), for reads past the end. */
  pass_pages: number[];
  next_pass_pages: number[];
  /** Every logged day (any cycle), so the editor can refuse a day twice. */
  logged_dates: string[];
  /** The caller's local today (D20), the editor's default date. */
  today: string;
}


type Supa = SupabaseClient;
/**
 * The caller's id. The teacher-read RLS policy (B3) also exposes students' rows
 * to the caller, so "my wirds" reads must filter by owner explicitly — RLS alone
 * is not a self-scope.
 */
export async function me(supabase: Supa): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');
  return user.id;
}
export const dayNumber = (isoDate: string) => Math.floor(Date.parse(isoDate) / 86_400_000);

/**
 * First and last page covered by any memorized range (D7). Returns null when
 * there are no ranges — the caller then rejects a 'memorized' wird (D10).
 */
export function memorizedBounds(ranges: MemorizedRange[]): { page_start: number; page_end: number } | null {
  if (ranges.length === 0) return null;
  let start = 605;
  let end = 0;
  for (const r of ranges) {
    start = Math.min(start, getPageForAyah(r.surah, r.from));
    end = Math.max(end, getPageForAyah(r.surah, r.to));
  }
  return { page_start: start, page_end: end };
}

/** Every page touched by any memorized range, ascending and unique (D7). */
export function memorizedPages(ranges: MemorizedRange[]): number[] {
  const set = new Set<number>();
  for (const r of ranges) {
    const from = getPageForAyah(r.surah, r.from);
    const to = getPageForAyah(r.surah, r.to);
    for (let p = from; p <= to; p += 1) set.add(p);
  }
  return [...set].sort((a, b) => a - b);
}

/**
 * The ordered pages of a wird's current pass. Pages-scope is the contiguous
 * cycle span; memorized-scope is the live memorized pages clamped to the frozen
 * cycle envelope — so gaps (unmemorized pages) are skipped, and pages memorized
 * mid-cycle (beyond the envelope) only join at the next wrap (D8).
 */
export function cyclePages(w: Wird, ranges: MemorizedRange[] | null): number[] {
  if (w.scope_source === 'memorized') {
    return memorizedPages(ranges ?? []).filter(
      (p) => p >= w.cycle_page_start && p <= w.cycle_page_end,
    );
  }
  return spanPages(w.cycle_page_start, w.cycle_page_end);
}

/**
 * The caller's live wirds, creation order, each with derived position, today's
 * portion, done-today flag and days-since-last-done (F1). Ordering per H5a is
 * computed here: outstanding wirds first (creation order), then those already
 * done today. No user filtering — RLS returns only the caller's rows (F4).
 */
export async function listWirds(supabase: Supa): Promise<WirdView[]> {
  const { data: wirds, error } = await supabase
    .from('wird')
    .select('*')
    .eq('user_id', await me(supabase))
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (wirds ?? []) as Wird[];
  if (rows.length === 0) return [];

  const { data: entryData, error: entryErr } = await supabase
    .from('wird_entry')
    .select('*')
    .in('wird_id', rows.map((w) => w.id));
  if (entryErr) throw entryErr;
  const entries = (entryData ?? []) as WirdEntry[];

  // Live memorized scope, resolved once (D7). Only fetched if any wird needs it.
  let ranges: MemorizedRange[] | null = null;
  const needsMemorized = rows.some((w) => w.scope_source === 'memorized');
  if (needsMemorized) ranges = await myRanges(supabase);

  const today = await todayLocal(supabase);
  const views: WirdView[] = rows.map((w) => {
    const mine = entries.filter((e) => e.wird_id === w.id);
    const bounds =
      w.scope_source === 'memorized' ? memorizedBounds(ranges ?? []) : null;
    const page_start = bounds?.page_start ?? w.page_start;
    const page_end = bounds?.page_end ?? w.page_end;

    // Portion runs off the frozen cycle bounds, never the live scope (D8).
    // The pass is an ordered page list (gap-skipping for memorized), stepped by
    // covered-count, so an unmemorized page is never handed out as a portion.
    let cycleEnds = mine.filter((e) => e.cycle_seq === w.cycle_seq).map((e) => e.page_end);
    let pages = cyclePages(w, ranges);
    const passLen = pages.length;
    const covered = coveredCount(cycleEnds, pages); // 0..passLen
    // Complete pass: the next Done wraps from the live scope (D5, completeWird),
    // so the portion comes from that wrapped pass, not this pass's first page.
    if (passLen > 0 && covered >= passLen) {
      pages = cyclePages({ ...w, cycle_page_start: page_start, cycle_page_end: page_end }, ranges);
      cycleEnds = [];
    }
    const len = pages.length;
    const rate = dailyRate(w.pages_per_period, w.period_days);
    const size = portionSize(cycleEnds.length + 1, rate);
    const startIdx = covered < passLen ? covered : 0;
    const endIdx = len === 0 ? 0 : Math.min(startIdx + size - 1, len - 1);
    const position = len === 0 ? w.cycle_page_start : pages[startIdx];
    const pEnd = len === 0 ? w.cycle_page_start : pages[endIdx];
    const doneToday = mine.some((e) => e.entry_date === today);
    // After today's Done: the next page in this pass, or the live scope's start
    // once the pass is used up (completeWird wraps from the live scope, D5).
    const next_position =
      doneToday || len === 0 ? position : endIdx + 1 < len ? pages[endIdx + 1] : page_start;

    const lastDone = mine.reduce<string | null>(
      (max, e) => (max === null || e.entry_date > max ? e.entry_date : max),
      null,
    );

    return {
      ...w,
      page_start,
      page_end,
      position,
      portion_start: position,
      portion_end: pEnd,
      done_today: doneToday,
      days_since_last_done: lastDone === null ? null : dayNumber(today) - dayNumber(lastDone),
      pages_remaining: Math.max(0, passLen - covered),
      pass_length: passLen,
      next_position,
      pass_pages: pages,
      next_pass_pages: cyclePages({ ...w, cycle_page_start: page_start, cycle_page_end: page_end }, ranges),
      logged_dates: mine.map((e) => e.entry_date),
      today,
    };
  });

  return orderWirdViews(views);
}


/**
 * Every completed entry_date grouped by wird, for the per-wird consistency
 * heatmap on the manage screen. One query; RLS scopes rows to the caller (F4).
 * Includes soft-deleted wirds' entries harmlessly (the caller only reads by the
 * live wird ids it renders).
 */
export async function listEntryDatesByWird(supabase: Supa): Promise<Record<string, string[]>> {
  const { data, error } = await supabase
    .from('wird_entry')
    .select('wird_id, entry_date, wird!inner(user_id)')
    .eq('wird.user_id', await me(supabase));
  if (error) throw error;
  const byWird: Record<string, string[]> = {};
  for (const e of (data ?? []) as { wird_id: string; entry_date: string }[]) {
    (byWird[e.wird_id] ??= []).push(e.entry_date);
  }
  return byWird;
}


/** The caller's memorized ranges (empty if none / signed out). */
export async function myRanges(supabase: Supa): Promise<MemorizedRange[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from('user_hifth').select('memorized_ranges').eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  return data?.memorized_ranges ?? [];
}

/**
 * Today in the caller's saved timezone (D20). No saved zone → UTC, explicitly:
 * the browser's own zone would disagree with completeWird on the server.
 */
export async function todayLocal(supabase: Supa): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return localDate('UTC');
  const { data } = await supabase.from('profiles').select('timezone').eq('id', user.id).maybeSingle();
  return localDate(data?.timezone ?? 'UTC');
}
