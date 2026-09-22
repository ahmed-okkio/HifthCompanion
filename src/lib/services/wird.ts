'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import {
  dailyRate,
  portionSize,
  wrapCycle,
  orderWirdViews,
  spanPages,
  coveredCount,
} from '@/lib/wirdRate';
import { getPageForAyah } from '@/lib/quran';
import { getMyMemorization } from '@/lib/services/profile';
import type { Wird, WirdEntry, WirdScopeSource, MemorizedRange } from '@/types';

// ---------------------------------------------------------------------------
// 0015 wird — CRUD + completion service (M3). No client-side user filtering:
// RLS is the gate (F4 [SEC]). All maths comes from @/lib/wirdRate — nothing is
// recomputed here. `scope_source = 'memorized'` bounds are re-derived from
// user_hifth.memorized_ranges on every read (D7); stored cycle_page_* are only
// ever rewritten at the wrap (D8).
// ---------------------------------------------------------------------------

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
}

const todayLocal = () => new Date().toISOString().slice(0, 10);
const dayNumber = (isoDate: string) => Math.floor(Date.parse(isoDate) / 86_400_000);

/**
 * First and last page covered by any memorized range (D7). Returns null when
 * there are no ranges — the caller then rejects a 'memorized' wird (D10).
 */
function memorizedBounds(ranges: MemorizedRange[]): { page_start: number; page_end: number } | null {
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
function memorizedPages(ranges: MemorizedRange[]): number[] {
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
function cyclePages(w: Wird, ranges: MemorizedRange[] | null): number[] {
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
export async function listWirds(): Promise<WirdView[]> {
  const supabase = await createClient();
  const { data: wirds, error } = await supabase
    .from('wird')
    .select('*')
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
  if (needsMemorized) ranges = (await getMyMemorization()).ranges;

  const today = todayLocal();
  const views: WirdView[] = rows.map((w) => {
    const mine = entries.filter((e) => e.wird_id === w.id);
    const bounds =
      w.scope_source === 'memorized' ? memorizedBounds(ranges ?? []) : null;
    const page_start = bounds?.page_start ?? w.page_start;
    const page_end = bounds?.page_end ?? w.page_end;

    // Portion runs off the frozen cycle bounds, never the live scope (D8).
    // The pass is an ordered page list (gap-skipping for memorized), stepped by
    // covered-count, so an unmemorized page is never handed out as a portion.
    const cycleEnds = mine.filter((e) => e.cycle_seq === w.cycle_seq).map((e) => e.page_end);
    const pages = cyclePages(w, ranges);
    const len = pages.length;
    const rate = dailyRate(w.pages_per_period, w.period_days);
    const covered = coveredCount(cycleEnds, pages); // 0..len
    const size = portionSize(cycleEnds.length + 1, rate);
    // Outstanding: next portion starts at index `covered`. Complete (covered ===
    // len): the next pass begins at the first page again (nextRef on a done card).
    const startIdx = covered < len ? covered : 0;
    const endIdx = len === 0 ? 0 : Math.min(startIdx + size - 1, len - 1);
    const position = len === 0 ? w.cycle_page_start : pages[startIdx];
    const pEnd = len === 0 ? w.cycle_page_start : pages[endIdx];

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
      done_today: mine.some((e) => e.entry_date === today),
      days_since_last_done: lastDone === null ? null : dayNumber(today) - dayNumber(lastDone),
      pages_remaining: Math.max(0, len - covered),
      pass_length: len,
    };
  });

  return orderWirdViews(views);
}

/**
 * Create a wird (F2). Name is trimmed and an empty/whitespace name is rejected
 * with no write. cycle_seq seeds to 1 with cycle_page_* = the resolved scope.
 * A 'memorized' wird with no memorized ranges is rejected server-side (D10).
 */
export async function createWird(input: {
  name: string;
  scope_source: WirdScopeSource;
  page_start?: number;
  page_end?: number;
  pages_per_period: number;
  period_days: number;
}): Promise<Wird> {
  const name = input.name.trim();
  if (name === '') throw new Error('Wird name is empty');

  let page_start: number;
  let page_end: number;
  if (input.scope_source === 'memorized') {
    const bounds = memorizedBounds((await getMyMemorization()).ranges);
    if (bounds === null) throw new Error('No memorized ranges to build a wird from');
    ({ page_start, page_end } = bounds);
  } else {
    if (input.page_start === undefined || input.page_end === undefined) {
      throw new Error('A pages wird needs page_start and page_end');
    }
    page_start = input.page_start;
    page_end = input.page_end;
  }

  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('wird')
    .insert({
      name,
      scope_source: input.scope_source,
      page_start,
      page_end,
      pages_per_period: input.pages_per_period,
      period_days: input.period_days,
      cycle_seq: 1,
      cycle_page_start: page_start,
      cycle_page_end: page_end,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Wird;
}

/** Soft-delete a wird (F3/D19). Entries are untouched and keep feeding the streak (E6). */
export async function deleteWird(id: string): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('wird')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** One entry as the manage-screen history shows it (D19 hard row, not soft). */
export interface WirdEntryRow {
  id: string;
  entry_date: string;
  page_start: number;
  page_end: number;
}

/**
 * The current cycle's entries for one wird, newest first, for the manage-screen
 * history. RLS returns only the caller's rows (F4). Only the live pass — past
 * cycles are excluded so history reads as "this pass so far".
 */
export async function listCycleEntries(wirdId: string): Promise<WirdEntryRow[]> {
  const supabase = await createClient();
  const { data: wirdData, error: wErr } = await supabase
    .from('wird')
    .select('cycle_seq')
    .eq('id', wirdId)
    .single();
  if (wErr) throw wErr;
  const { data, error } = await supabase
    .from('wird_entry')
    .select('id, entry_date, page_start, page_end')
    .eq('wird_id', wirdId)
    .eq('cycle_seq', (wirdData as { cycle_seq: number }).cycle_seq)
    .order('entry_date', { ascending: false });
  if (error) throw error;
  return (data ?? []) as WirdEntryRow[];
}

/**
 * Undo one logged day (F5): hard-delete the entry. Position derives from the
 * remaining entries, so deleting today's re-opens today and steps the pass back
 * one portion. RLS gates the delete to the owner (B-policies).
 */
export async function deleteWirdEntry(entryId: string): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase.from('wird_entry').delete().eq('id', entryId);
  if (error) throw error;
}

/**
 * Edit a wird's name, scope and rate. Name and rate change in place. A scope
 * change restarts the current pass on the new range (cycle_seq bumps, position
 * resets to the new start) — past entries are untouched and keep feeding the
 * streak (E6), they simply no longer count toward the new cycle's position.
 */
export async function updateWird(
  id: string,
  input: {
    name: string;
    scope_source: WirdScopeSource;
    page_start?: number;
    page_end?: number;
    pages_per_period: number;
    period_days: number;
  },
): Promise<void> {
  const name = input.name.trim();
  if (name === '') throw new Error('Wird name is empty');

  let page_start: number;
  let page_end: number;
  if (input.scope_source === 'memorized') {
    const bounds = memorizedBounds((await getMyMemorization()).ranges);
    if (bounds === null) throw new Error('No memorized ranges to build a wird from');
    ({ page_start, page_end } = bounds);
  } else {
    if (input.page_start === undefined || input.page_end === undefined) {
      throw new Error('A pages wird needs page_start and page_end');
    }
    page_start = input.page_start;
    page_end = input.page_end;
  }

  const supabase = await createClientAction();
  const { data, error } = await supabase.from('wird').select('*').eq('id', id).single();
  if (error) throw error;
  const cur = data as Wird;

  const scopeChanged =
    input.scope_source !== cur.scope_source ||
    page_start !== cur.cycle_page_start ||
    page_end !== cur.cycle_page_end;

  const patch: Partial<Wird> = {
    name,
    scope_source: input.scope_source,
    page_start,
    page_end,
    pages_per_period: input.pages_per_period,
    period_days: input.period_days,
  };
  if (scopeChanged) {
    patch.cycle_seq = cur.cycle_seq + 1;
    patch.cycle_page_start = page_start;
    patch.cycle_page_end = page_end;
  }

  const { error: upErr } = await supabase.from('wird').update(patch).eq('id', id);
  if (upErr) throw upErr;
}

/**
 * Complete a wird's portion for today (D2). Idempotent per wird per local day
 * (D3/F5): a second Done the same local day writes nothing. When the current
 * pass is already complete, the wrap runs first (D5, via wrapCycle) — cycle_seq
 * increments and cycle_page_* reset from the live scope — and the entry is
 * written against the new cycle. Writes exactly one entry: today, the computed
 * portion start+end, and the cycle_seq it belongs to.
 */
export async function completeWird(id: string): Promise<void> {
  const supabase = await createClientAction();
  const { data, error } = await supabase.from('wird').select('*').eq('id', id).single();
  if (error) throw error;
  const wird = data as Wird;

  const today = todayLocal();
  const { data: entryData, error: entryErr } = await supabase
    .from('wird_entry')
    .select('*')
    .eq('wird_id', id);
  if (entryErr) throw entryErr;
  const entries = (entryData ?? []) as WirdEntry[];

  // D3/F5: already done today → no write, no advance.
  if (entries.some((e) => e.entry_date === today)) return;

  const ranges =
    wird.scope_source === 'memorized' ? (await getMyMemorization()).ranges : null;

  let { cycle_seq, cycle_page_start, cycle_page_end } = wird;
  let cycleEnds = entries.filter((e) => e.cycle_seq === cycle_seq).map((e) => e.page_end);
  let pages = cyclePages({ ...wird, cycle_seq, cycle_page_start, cycle_page_end }, ranges);

  // The next Done after a pass completes wraps (D5): reset bounds from the live
  // scope, persist them (the only time cycle_page_* are rewritten, D8), and
  // write against the new cycle. Completion is by covered-count over the ordered
  // page list, so a gappy memorized pass wraps once its real pages are all done.
  if (pages.length > 0 && coveredCount(cycleEnds, pages) >= pages.length) {
    const scope =
      wird.scope_source === 'memorized'
        ? memorizedBounds(ranges ?? []) ?? {
            page_start: wird.page_start,
            page_end: wird.page_end,
          }
        : { page_start: wird.page_start, page_end: wird.page_end };
    const next = wrapCycle(
      { cycle_seq, cycle_page_start, cycle_page_end },
      scope.page_start,
      scope.page_end,
    );
    ({ cycle_seq, cycle_page_start, cycle_page_end } = next);
    const { error: wrapErr } = await supabase
      .from('wird')
      .update({ cycle_seq, cycle_page_start, cycle_page_end })
      .eq('id', id);
    if (wrapErr) throw wrapErr;
    cycleEnds = [];
    pages = cyclePages({ ...wird, cycle_seq, cycle_page_start, cycle_page_end }, ranges);
  }

  if (pages.length === 0) return; // nothing to recite (no memorized pages)

  const rate = dailyRate(wird.pages_per_period, wird.period_days);
  const covered = coveredCount(cycleEnds, pages);
  const size = portionSize(cycleEnds.length + 1, rate);
  const endIdx = Math.min(covered + size - 1, pages.length - 1);

  const { error: insErr } = await supabase.from('wird_entry').insert({
    wird_id: id,
    entry_date: today,
    page_start: pages[covered],
    page_end: pages[endIdx],
    cycle_seq,
  });
  if (insErr) throw insErr;
}

/** A teacher-facing merged summary of one student's wird practice (L1/D17). */
export interface StudentWirdSummary {
  /** How many active (non-deleted) wirds the student keeps. */
  wird_count: number;
  /** Distinct days the student logged any wird portion. */
  active_days: number;
  /** Whole days since the most recent entry across all wirds; null if never. */
  days_since_last: number | null;
}

/**
 * A read-only, merged summary of one student's wird practice for their teacher
 * (L1/D17). Scoped to the given studentId — which student to show — NOT a
 * permission check: RLS policy B3 (`public.teaches_user`) is the gate, so this
 * read returns rows only when the caller actually teaches that student. No
 * client-side teacher check here. Returns null when the student has no wirds
 * (L4 renders no card). Uses createClient (read); never writes.
 */
export async function getStudentWirdSummary(userId: string): Promise<StudentWirdSummary | null> {
  const supabase = await createClient();
  const { data: wirds, error } = await supabase
    .from('wird')
    .select('id')
    .eq('user_id', userId)
    .is('deleted_at', null);
  if (error) throw error;
  const ids = (wirds ?? []).map((w: { id: string }) => w.id);
  if (ids.length === 0) return null;

  const { data: entryData, error: entryErr } = await supabase
    .from('wird_entry')
    .select('entry_date')
    .in('wird_id', ids);
  if (entryErr) throw entryErr;
  const dates: string[] = (entryData ?? []).map((e: { entry_date: string }) => e.entry_date);

  const uniqueDays = new Set(dates);
  const lastDone = dates.reduce<string | null>(
    (max, d) => (max === null || d > max ? d : max),
    null,
  );
  return {
    wird_count: ids.length,
    active_days: uniqueDays.size,
    days_since_last: lastDone === null ? null : dayNumber(todayLocal()) - dayNumber(lastDone),
  };
}

/**
 * Every completed entry_date grouped by wird, for the per-wird consistency
 * heatmap on the manage screen. One query; RLS scopes rows to the caller (F4).
 * Includes soft-deleted wirds' entries harmlessly (the caller only reads by the
 * live wird ids it renders).
 */
export async function listEntryDatesByWird(): Promise<Record<string, string[]>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('wird_entry').select('wird_id, entry_date');
  if (error) throw error;
  const byWird: Record<string, string[]> = {};
  for (const e of (data ?? []) as { wird_id: string; entry_date: string }[]) {
    (byWird[e.wird_id] ??= []).push(e.entry_date);
  }
  return byWird;
}

/**
 * Every entry_date of the caller's wird entries, for the merged streak (E5, via
 * streak.mergeActivity). Soft-deleted wirds' entries are included — they still
 * count toward the streak (E6). RLS scopes the rows to the caller (F4).
 */
export async function listWirdEntryDates(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from('wird_entry').select('entry_date');
  if (error) throw error;
  return (data ?? []).map((e: { entry_date: string }) => e.entry_date);
}
