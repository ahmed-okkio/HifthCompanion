import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeStreak } from '@/lib/streak';

const day = (offset: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

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
