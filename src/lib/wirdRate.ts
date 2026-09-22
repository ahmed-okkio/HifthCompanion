// ---------------------------------------------------------------------------
// 0015 wird — rate / portion / position maths. Pure, no I/O, no `new Date()`.
// The rate is stored as-is (never rounded, C1); every portion size is derived
// from it via the floor difference in C2, which is what keeps 100/14 summing
// to exactly 100 with no rounding drift.
// ---------------------------------------------------------------------------

/** Daily rate = pages_per_period / period_days, never rounded (C1). */
export function dailyRate(pagesPerPeriod: number, periodDays: number): number {
  return pagesPerPeriod / periodDays;
}

/**
 * Size of the (1-based) day-n portion (C2): floor(n·r) − floor((n−1)·r).
 * Never floor(r): that would lose the fractional pages that C2 spreads across
 * days so the sizes still sum to the whole page count.
 */
export function portionSize(n: number, rate: number): number {
  return Math.floor(n * rate) - Math.floor((n - 1) * rate);
}

/** Sizes for the first `count` days; sums to floor(count·r). */
export function portionSizes(count: number, rate: number): number[] {
  return Array.from({ length: count }, (_, i) => portionSize(i + 1, rate));
}

/**
 * Last page actually covered in the current cycle, or `cyclePageStart - 1`
 * when the cycle has no entries yet. `entryEnds` are the page_end values of
 * the current cycle_seq's entries.
 */
export function lastCoveredPage(entryEnds: number[], cyclePageStart: number): number {
  return entryEnds.length ? Math.max(...entryEnds) : cyclePageStart - 1;
}

/**
 * Position = max(page_end)+1 over the current cycle's entries, else
 * cycle_page_start (D1). Clamped to cycle_page_end so a shrunk scope reads full
 * rather than over-full (D9). The position is never rewritten without a Done.
 */
export function currentPosition(
  entryEnds: number[],
  cyclePageStart: number,
  cyclePageEnd: number,
): number {
  if (entryEnds.length === 0) return cyclePageStart;
  return Math.min(Math.max(...entryEnds) + 1, cyclePageEnd);
}

/** Pages left in the current pass, from the position to cycle_page_end (H11). Never negative. */
export function pagesRemaining(
  entryEnds: number[],
  cyclePageStart: number,
  cyclePageEnd: number,
): number {
  return Math.max(0, cyclePageEnd - lastCoveredPage(entryEnds, cyclePageStart));
}

/**
 * True once the current pass has reached cycle_page_end: the next Done wraps
 * (D5). Also the D9 case where a shrunk scope puts the last covered page at or
 * past cycle_page_end.
 */
export function passComplete(entryEnds: number[], cyclePageEnd: number): boolean {
  return entryEnds.length > 0 && Math.max(...entryEnds) >= cyclePageEnd;
}

/** Portion end page: start + size − 1, clamped so it never passes cycle_page_end (C4). */
export function portionEnd(position: number, size: number, cyclePageEnd: number): number {
  return Math.min(position + size - 1, cyclePageEnd);
}

/**
 * Projected finish (C5): the smallest n whose cumulative portion covers the
 * `remaining` pages of the current pass. 0 when nothing remains. `now`/`today`
 * are the caller's concern — this returns a day count to add to it.
 */
export function projectedFinishDays(remaining: number, rate: number): number {
  if (remaining <= 0) return 0;
  let n = 0;
  let cumulative = 0;
  while (cumulative < remaining) {
    n += 1;
    cumulative += portionSize(n, rate);
  }
  return n;
}

/**
 * The ordered pages of a contiguous span [start..end]. The pages-scope pass is
 * simply this; a memorized-scope pass is a gappy subset (see the service).
 */
export function spanPages(start: number, end: number): number[] {
  const out: number[] = [];
  for (let p = start; p <= end; p += 1) out.push(p);
  return out;
}

/**
 * How many of the pass's ordered `pages` are already covered this cycle. Entries
 * cover a prefix of the ordered list, so the covered count is the number of
 * pages at or before the furthest page_end. Gap-safe: memorized passes skip the
 * pages that were never memorized, so a portion that ends on the last page
 * before a gap still counts only the pages that exist in `pages`.
 */
export function coveredCount(entryEnds: number[], pages: number[]): number {
  if (entryEnds.length === 0) return 0;
  const maxEnd = Math.max(...entryEnds);
  return pages.filter((p) => p <= maxEnd).length;
}

export interface WirdCycle {
  cycle_seq: number;
  cycle_page_start: number;
  cycle_page_end: number;
}

/**
 * The wrap (D5): the next cycle after a pass completes. cycle_seq+1 and
 * cycle_page_* reset from the wird's *live* scope — so newly-declared memorized
 * ranges (D8) take effect here, at the wrap, and not mid-pass. Pure; the M3
 * service calls this when writing the wrapping entry.
 */
export function wrapCycle(cycle: WirdCycle, scopePageStart: number, scopePageEnd: number): WirdCycle {
  return {
    cycle_seq: cycle.cycle_seq + 1,
    cycle_page_start: scopePageStart,
    cycle_page_end: scopePageEnd,
  };
}

/**
 * H5a ordering (O4a). Pure so it is unit-testable without a DB — `listWirds`
 * calls this after computing views. Outstanding wirds first, in their given
 * (creation) order, then those already done today. Completing a wird flips its
 * `done_today`, so on the next load it falls after the still-outstanding ones.
 */
export function orderWirdViews<T extends { done_today: boolean }>(views: T[]): T[] {
  return [...views.filter((v) => !v.done_today), ...views.filter((v) => v.done_today)];
}
