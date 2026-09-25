import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeStreak, isStreakAtRisk, mergeActivity } from '@/lib/streak';
import { addDays, localDate } from '@/lib/localDate';

const day = (offset: number) => addDays(localDate(), offset);

describe('computeStreak', () => {
  afterEach(() => vi.useRealTimers());

  it('returns 0 for no logs', () => {
    expect(computeStreak([])).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    expect(computeStreak([{ log_date: day(0) }, { log_date: day(-1) }, { log_date: day(-2) }])).toBe(3);
  });

  it('stays alive when latest log was yesterday', () => {
    expect(computeStreak([{ log_date: day(-1) }, { log_date: day(-2) }])).toBe(2);
  });

  it('breaks on a gap', () => {
    expect(computeStreak([{ log_date: day(0) }, { log_date: day(-2) }])).toBe(1);
  });

  it('is 0 when the most recent log is older than yesterday', () => {
    expect(computeStreak([{ log_date: day(-3) }, { log_date: day(-4) }])).toBe(0);
  });

  it('dedupes multiple logs on the same day', () => {
    expect(computeStreak([{ log_date: day(0) }, { log_date: day(0) }, { log_date: day(-1) }])).toBe(2);
  });
});

describe('computeStreak — explicit today', () => {
  it('counts back across a month boundary from the given local date', () => {
    const logs = ['2026-03-01', '2026-02-28', '2026-02-27'].map((log_date) => ({ log_date }));
    expect(computeStreak(logs, '2026-03-01')).toBe(3);
  });
});

describe('isStreakAtRisk', () => {
  afterEach(() => vi.useRealTimers());

  it('is false with no logs', () => {
    expect(isStreakAtRisk([], day(0))).toBe(false);
  });

  it('is false when there is a log today (streak already extended)', () => {
    expect(isStreakAtRisk([{ log_date: day(0) }, { log_date: day(-1) }], day(0))).toBe(false);
  });

  it('is true when streak alive (logged yesterday) but nothing today', () => {
    expect(isStreakAtRisk([{ log_date: day(-1) }, { log_date: day(-2) }], day(0))).toBe(true);
  });

  it('is false when streak is dead (latest log older than yesterday)', () => {
    expect(isStreakAtRisk([{ log_date: day(-3) }, { log_date: day(-4) }], day(0))).toBe(false);
  });

  it('defaults today to the current day', () => {
    expect(isStreakAtRisk([{ log_date: day(-1) }])).toBe(true);
    expect(isStreakAtRisk([{ log_date: day(0) }])).toBe(false);
  });
});

describe('mergeActivity — merged streak (E1–E4, E6)', () => {
  afterEach(() => vi.useRealTimers());

  it('a day counts once whether it has a log, a wird entry, or both (E2)', () => {
    const merged = mergeActivity([{ log_date: day(0) }, { log_date: day(-2) }], [day(-1), day(-2)]);
    // days 0,-1,-2 all covered → streak 3; -2 present in both counts once
    expect(computeStreak(merged)).toBe(3);
  });

  it('a user with no logs but wird entries has a non-zero streak (E3)', () => {
    const merged = mergeActivity([], [day(0), day(-1)]);
    expect(computeStreak(merged)).toBe(2);
  });

  it('wird entries still count even when only they exist (E6 — soft-deleted wird entries persist)', () => {
    // soft-deleting the wird does not drop its entries from the stream
    expect(computeStreak(mergeActivity([], [day(-1)]))).toBe(2 - 1); // 1
  });

  it('isStreakAtRisk works over the merged stream (E4)', () => {
    // alive from yesterday's wird entry, nothing today → at risk
    expect(isStreakAtRisk(mergeActivity([], [day(-1)]), day(0))).toBe(true);
    // wird entry today → not at risk
    expect(isStreakAtRisk(mergeActivity([], [day(0)]), day(0))).toBe(false);
  });
});
