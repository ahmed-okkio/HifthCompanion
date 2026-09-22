import { describe, it, expect } from 'vitest';
import {
  dailyRate,
  portionSize,
  portionSizes,
  currentPosition,
  pagesRemaining,
  passComplete,
  portionEnd,
  projectedFinishDays,
  wrapCycle,
  spanPages,
  coveredCount,
} from '@/lib/wirdRate';

describe('rate (C1)', () => {
  it('is pages_per_period / period_days, never rounded', () => {
    expect(dailyRate(100, 14)).toBeCloseTo(100 / 14, 12);
    expect(dailyRate(20, 1)).toBe(20);
    expect(dailyRate(1, 10)).toBeCloseTo(0.1, 12);
  });
});

describe('portion size (C2)', () => {
  it('100 / 14 gives 7,7,7,7,7,7,8,7,7,7,7,7,7,8 summing to 100', () => {
    const sizes = portionSizes(14, dailyRate(100, 14));
    expect(sizes).toEqual([7, 7, 7, 7, 7, 7, 8, 7, 7, 7, 7, 7, 7, 8]);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(100);
  });

  it('20 / 1 gives exactly 20 every day with no drift (C6)', () => {
    const sizes = portionSizes(30, dailyRate(20, 1));
    expect(sizes.every((s) => s === 20)).toBe(true);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(600);
  });

  it('is floor(n·r)−floor((n−1)·r), not floor(r)', () => {
    const r = dailyRate(100, 14);
    expect(Math.floor(r)).toBe(7); // floor(r) would lose a page every ~7 days
    expect(portionSize(7, r)).toBe(8);
  });

  it('every whole page is emitted (never fractional, C3)', () => {
    for (const [p, d] of [[100, 14], [20, 1], [30, 7], [1, 10]] as const) {
      expect(portionSizes(d, dailyRate(p, d)).every(Number.isInteger)).toBe(true);
    }
  });
});

describe('position (D1) and remaining (H11)', () => {
  it('is cycle_page_start with no entries', () => {
    expect(currentPosition([], 1, 604)).toBe(1);
    expect(pagesRemaining([], 1, 604)).toBe(604);
  });

  it('is max(page_end)+1 over the cycle entries', () => {
    expect(currentPosition([7, 14], 1, 604)).toBe(15);
    expect(pagesRemaining([7, 14], 1, 604)).toBe(590); // 604 - 14
  });
});

describe('clamp (C4)', () => {
  it('never extends a portion past cycle_page_end', () => {
    expect(portionEnd(600, 8, 604)).toBe(604);
    expect(portionEnd(1, 7, 604)).toBe(7);
  });
});

describe('wrap (D5)', () => {
  it('completes the pass when the last entry reaches cycle_page_end', () => {
    expect(passComplete([604], 604)).toBe(true);
    expect(passComplete([600], 604)).toBe(false);
    expect(pagesRemaining([604], 1, 604)).toBe(0);
  });

  it('increments cycle_seq and resets bounds from the live scope', () => {
    expect(wrapCycle({ cycle_seq: 1, cycle_page_start: 1, cycle_page_end: 604 }, 50, 100)).toEqual({
      cycle_seq: 2,
      cycle_page_start: 50,
      cycle_page_end: 100,
    });
  });
});

describe('frozen denominator (D8)', () => {
  it('remaining uses the pass bounds, not new live scope', () => {
    // pass in flight ends at 604; declaring a bigger memorized scope must not
    // change the denominator until the next wrap.
    expect(pagesRemaining([300], 1, 604)).toBe(304);
  });
});

describe('shrink-clamp (D9)', () => {
  it('clamps position to cycle_page_end and reads full when scope shrinks below it', () => {
    // entries reached page 604 but the frozen end is now 500: position clamps,
    // remaining is 0 (bar full, not over-full), next Done wraps.
    expect(currentPosition([604], 1, 500)).toBe(500);
    expect(pagesRemaining([604], 1, 500)).toBe(0);
    expect(passComplete([604], 500)).toBe(true);
  });
});

describe('projected finish (C5)', () => {
  it('is the smallest n whose cumulative portion covers the remaining pages', () => {
    expect(projectedFinishDays(100, dailyRate(100, 14))).toBe(14);
    expect(projectedFinishDays(0, dailyRate(100, 14))).toBe(0);
    expect(projectedFinishDays(20, dailyRate(20, 1))).toBe(1);
    expect(projectedFinishDays(21, dailyRate(20, 1))).toBe(2);
  });
});

describe('gap-skipping pass (memorized scope)', () => {
  // Fatiha (page 1) + a later block (pages 500–502): the pass is the ordered
  // union, so portions never hand out the unmemorized pages 2–499.
  const pages = [...spanPages(500, 502)];
  const gappy = [1, ...pages]; // [1, 500, 501, 502]

  it('spanPages lists a contiguous span inclusively', () => {
    expect(spanPages(500, 502)).toEqual([500, 501, 502]);
  });

  it('covered-count counts only pages at/before the furthest entry end', () => {
    expect(coveredCount([], gappy)).toBe(0);
    expect(coveredCount([1], gappy)).toBe(1); // page 1 done → next is 500, not 2
    expect(coveredCount([501], gappy)).toBe(3); // 1,500,501 covered
    expect(coveredCount([502], gappy)).toBe(4); // whole pass done
  });

  it('steps portions across the gap by index, never landing in it', () => {
    // rate 2 pages/day. After page 1 is done (covered=1), the next 2-page
    // portion is pages[1..2] = 500–501, skipping 2–499 entirely.
    const rate = dailyRate(2, 1);
    const covered = coveredCount([1], gappy);
    const size = portionSize(1 + 1, rate); // = 2
    const endIdx = Math.min(covered + size - 1, gappy.length - 1);
    expect(gappy[covered]).toBe(500);
    expect(gappy[endIdx]).toBe(501);
  });
});
