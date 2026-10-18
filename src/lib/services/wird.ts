'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import { dailyRate, portionSize, wrapCycle, coveredCount, splitRead, type WirdCycle } from '@/lib/wirdRate';
import { me, memorizedBounds, cyclePages } from '@/lib/wirdRead';
import { getMyMemorization, getMyProfile } from '@/lib/services/profile';
import { localDate } from '@/lib/localDate';
import type { Wird, WirdEntry, WirdScopeSource } from '@/types';

// ---------------------------------------------------------------------------
// 0015 wird — CRUD + completion service (M3). No client-side user filtering:
// RLS is the gate (F4 [SEC]). All maths comes from @/lib/wirdRate — nothing is
// recomputed here. `scope_source = 'memorized'` bounds are re-derived from
// user_hifth.memorized_ranges on every read (D7); stored cycle_page_* are only
// ever rewritten at the wrap (D8).
// ---------------------------------------------------------------------------

/**
 * Today in the caller's saved timezone (D20: a local-midnight day). The server
 * runs in UTC, so its own clock can't be used — after 8 pm in New York that is
 * already tomorrow. No saved zone yet → UTC. The reminder cron uses the same
 * rule (see src/lib/wirdReminder.ts), so "done today" means one thing.
 */
async function todayLocal(): Promise<string> {
  return localDate((await getMyProfile())?.timezone);
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
  /** Where the first pass begins (already midway through). Clamped into scope;
      later passes run the full scope (wrap resets cycle_page_start). */
  start_page?: number;
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
      cycle_page_start: Math.min(Math.max(input.start_page ?? page_start, page_start), page_end),
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
    .eq('id', id)
    .eq('user_id', await me(supabase));
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
    .eq('user_id', await me(supabase))
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
  const { data, error } = await supabase
    .from('wird')
    .select('*')
    .eq('id', id)
    .eq('user_id', await me(supabase))
    .single();
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
 * Complete a wird's portion (D2). Idempotent per wird per local day (D3/F5): a
 * second Done the same local day writes nothing. When the current pass is
 * already complete, the wrap runs first (D5, via wrapCycle) — cycle_seq
 * increments and cycle_page_* reset from the live scope — and the entry is
 * written against the new cycle.
 *
 * The pen editor passes `opts`: `date` logs a past day the user forgot
 * (default today; a past date already logged is rejected), `start` is the page
 * they started from and `count` how many pages they read (defaults: today's
 * position and portion). A read past the pass end writes two entries for the
 * day — this pass's tail, then the next pass's head after the wrap.
 */
export async function completeWird(
  id: string,
  opts: { date?: string; start?: number; count?: number } = {},
): Promise<void> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('wird')
    .select('*')
    .eq('id', id)
    .eq('user_id', await me(supabase))
    .single();
  if (error) throw error;
  const wird = data as Wird;

  const today = await todayLocal();
  const date = opts.date ?? today;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today) throw new Error('Invalid wird date');
  const { data: entryData, error: entryErr } = await supabase
    .from('wird_entry')
    .select('*')
    .eq('wird_id', id);
  if (entryErr) throw entryErr;
  const entries = (entryData ?? []) as WirdEntry[];

  // D3/F5: already done today → no write, no advance. A past day logged twice
  // is a stale editor, not a double tap — say so.
  if (entries.some((e) => e.entry_date === date)) {
    if (date === today) return;
    throw new Error('That day is already logged');
  }

  const ranges =
    wird.scope_source === 'memorized' ? (await getMyMemorization()).ranges : null;
  // The live scope: where the next pass runs (D5).
  const scope =
    wird.scope_source === 'memorized'
      ? memorizedBounds(ranges ?? []) ?? { page_start: wird.page_start, page_end: wird.page_end }
      : { page_start: wird.page_start, page_end: wird.page_end };
  const wrap = async (c: WirdCycle) => {
    const next = wrapCycle(c, scope.page_start, scope.page_end);
    const { error: wrapErr } = await supabase.from('wird').update(next).eq('id', id);
    if (wrapErr) throw wrapErr;
    return next;
  };

  let cycle: WirdCycle = {
    cycle_seq: wird.cycle_seq,
    cycle_page_start: wird.cycle_page_start,
    cycle_page_end: wird.cycle_page_end,
  };
  let cycleEnds = entries.filter((e) => e.cycle_seq === cycle.cycle_seq).map((e) => e.page_end);
  let pages = cyclePages({ ...wird, ...cycle }, ranges);

  // The next Done after a pass completes wraps (D5): reset bounds from the live
  // scope, persist them (the only time cycle_page_* are rewritten, D8), and
  // write against the new cycle. Completion is by covered-count over the ordered
  // page list, so a gappy memorized pass wraps once its real pages are all done.
  if (pages.length > 0 && coveredCount(cycleEnds, pages) >= pages.length) {
    cycle = await wrap(cycle);
    cycleEnds = [];
    pages = cyclePages({ ...wird, ...cycle }, ranges);
  }

  if (pages.length === 0) return; // nothing to recite (no memorized pages)

  const rate = dailyRate(wird.pages_per_period, wird.period_days);
  const startIdx = opts.start === undefined ? coveredCount(cycleEnds, pages) : pages.indexOf(opts.start);
  if (startIdx < 0) throw new Error('Start page is outside this pass');
  const nextPages = cyclePages(
    { ...wird, cycle_page_start: scope.page_start, cycle_page_end: scope.page_end },
    ranges,
  );
  const parts = splitRead(pages, nextPages, startIdx, opts.count ?? portionSize(cycleEnds.length + 1, rate));

  for (const part of parts) {
    if (part.wrap) cycle = await wrap(cycle);
    const { error: insErr } = await supabase.from('wird_entry').insert({
      wird_id: id,
      entry_date: date,
      page_start: part.page_start,
      page_end: part.page_end,
      cycle_seq: cycle.cycle_seq,
    });
    if (insErr) throw insErr;
  }
}

/** A teacher-facing summary of one student's wird practice (L1/D17). */
export interface StudentWirdSummary {
  /** Each active wird with its last 7 days (oldest → today); true = completed that day. */
  wirds: { id: string; name: string; week: boolean[] }[];
  /** Whole days since the most recent entry across all wirds; null if never. */
  days_since_last: number | null;
}

/** Whether the caller keeps any live wird — gates the Settings reminder row (0016). RLS scopes to the caller. */
export async function hasWirds(): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('wird')
    .select('id')
    .eq('user_id', await me(supabase))
    .is('deleted_at', null);
  if (error) throw error;
  return (data ?? []).length > 0;
}
