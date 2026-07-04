import { describe, it, expect } from 'vitest';
import { validate, normalize, juzToRanges, subtractRanges } from '../lib/memorization';
import { AYAH_COUNTS } from '../lib/quran';

describe('normalize', () => {
  it('sorts and merges overlapping/adjacent ranges within a surah (L1)', () => {
    expect(
      normalize([
        { surah: 2, from: 40, to: 100 },
        { surah: 2, from: 1, to: 50 },
      ])
    ).toEqual([{ surah: 2, from: 1, to: 100 }]);
  });

  it('merges adjacent ranges (to+1 === next.from)', () => {
    expect(
      normalize([
        { surah: 1, from: 1, to: 3 },
        { surah: 1, from: 4, to: 7 },
      ])
    ).toEqual([{ surah: 1, from: 1, to: 7 }]);
  });

  it('keeps distinct surahs separate', () => {
    const out = normalize([
      { surah: 2, from: 1, to: 5 },
      { surah: 1, from: 1, to: 7 },
    ]);
    expect(out).toEqual([
      { surah: 1, from: 1, to: 7 },
      { surah: 2, from: 1, to: 5 },
    ]);
  });
});

describe('validate', () => {
  it('accepts empty list (L3)', () => {
    expect(validate([])).toBe(true);
  });

  it('accepts a valid range', () => {
    expect(validate([{ surah: 2, from: 1, to: AYAH_COUNTS[2] }])).toBe(true);
  });

  it('rejects surah > 114 (L2)', () => {
    expect(validate([{ surah: 115, from: 1, to: 1 }])).toBe(false);
  });

  it('rejects from < 1 (L2)', () => {
    expect(validate([{ surah: 1, from: 0, to: 3 }])).toBe(false);
  });

  it('rejects from > to (L2)', () => {
    expect(validate([{ surah: 1, from: 5, to: 2 }])).toBe(false);
  });

  it('rejects to > AYAH_COUNTS[surah] (L2)', () => {
    expect(validate([{ surah: 1, from: 1, to: AYAH_COUNTS[1] + 1 }])).toBe(false);
  });
});

describe('subtractRanges', () => {
  it('splits a range around an interior gap', () => {
    expect(
      subtractRanges([{ surah: 2, from: 1, to: 100 }], [{ surah: 2, from: 40, to: 50 }])
    ).toEqual([
      { surah: 2, from: 1, to: 39 },
      { surah: 2, from: 51, to: 100 },
    ]);
  });

  it('trims edges and ignores other surahs', () => {
    expect(
      subtractRanges(
        [{ surah: 2, from: 1, to: 10 }, { surah: 3, from: 1, to: 5 }],
        [{ surah: 2, from: 1, to: 3 }]
      )
    ).toEqual([
      { surah: 2, from: 4, to: 10 },
      { surah: 3, from: 1, to: 5 },
    ]);
  });

  it('round-trips a juz minus a gap back through subtract', () => {
    const juz = juzToRanges(30);
    const gap = subtractRanges(juz, [{ surah: 114, from: 1, to: AYAH_COUNTS[114] }]);
    expect(validate(gap)).toBe(true);
    // Surah 114 (fully gapped) must be absent from the result.
    expect(gap.some((r) => r.surah === 114)).toBe(false);
  });
});

describe('juzToRanges', () => {
  it('returns non-empty valid ranges for juz 30 (L4)', () => {
    const r = juzToRanges(30);
    expect(r.length).toBeGreaterThan(0);
    expect(validate(r)).toBe(true);
  });

  it('normalize collapses two contiguous juz (L4)', () => {
    const combined = normalize([...juzToRanges(1), ...juzToRanges(2)]);
    const separate = juzToRanges(1).length + juzToRanges(2).length;
    // The boundary surah spanning juz 1→2 collapses, so fewer ranges than the sum.
    expect(combined.length).toBeLessThan(separate);
    expect(validate(combined)).toBe(true);
  });
});
