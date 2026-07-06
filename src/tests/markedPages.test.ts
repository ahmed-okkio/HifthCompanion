import { describe, it, expect } from 'vitest';
import {
  badgeLevel,
  maxCount,
  isNeedsFocus,
  sortMarked,
  objectCount,
  type MarkedPage,
} from '../lib/markedPages';

describe('badgeLevel (L2)', () => {
  it('grey 1-2, orange 3-5, red 6+ with boundaries', () => {
    expect(badgeLevel(1)).toBe('grey');
    expect(badgeLevel(2)).toBe('grey');
    expect(badgeLevel(3)).toBe('orange');
    expect(badgeLevel(5)).toBe('orange');
    expect(badgeLevel(6)).toBe('red');
    expect(badgeLevel(99)).toBe('red');
  });
});

describe('objectCount (L1)', () => {
  it('counts objects; a multi-point stroke is one object', () => {
    expect(objectCount({ objects: [{ type: 'path' }, { type: 'circle' }] })).toBe(2);
    expect(objectCount({ objects: [] })).toBe(0);
    expect(objectCount(null)).toBe(0);
    expect(objectCount({} as any)).toBe(0);
  });
});

describe('maxCount / isNeedsFocus (L3)', () => {
  it('empty set tags nothing', () => {
    const rows: MarkedPage[] = [];
    const max = maxCount(rows);
    expect(max).toBe(0);
    expect(isNeedsFocus(0, max)).toBe(false);
  });

  it('unique max tags exactly one page', () => {
    const rows: MarkedPage[] = [{ page: 3, count: 5 }, { page: 1, count: 2 }];
    const max = maxCount(rows);
    expect(max).toBe(5);
    expect(rows.filter((r) => isNeedsFocus(r.count, max)).map((r) => r.page)).toEqual([3]);
  });

  it('tie at max tags all tied pages', () => {
    const rows: MarkedPage[] = [{ page: 3, count: 4 }, { page: 1, count: 4 }, { page: 2, count: 1 }];
    const max = maxCount(rows);
    expect(rows.filter((r) => isNeedsFocus(r.count, max)).map((r) => r.page).sort()).toEqual([1, 3]);
  });
});

describe('sortMarked (L4)', () => {
  it('sorts count desc then page asc, ties stable, does not mutate input', () => {
    const rows: MarkedPage[] = [
      { page: 5, count: 2 },
      { page: 2, count: 4 },
      { page: 1, count: 4 },
      { page: 9, count: 1 },
    ];
    const sorted = sortMarked(rows);
    expect(sorted).toEqual([
      { page: 1, count: 4 },
      { page: 2, count: 4 },
      { page: 5, count: 2 },
      { page: 9, count: 1 },
    ]);
    expect(rows[0]).toEqual({ page: 5, count: 2 }); // input untouched
  });
});
