import { describe, it, expect } from 'vitest';
import {
  badgeLevel,
  maxCount,
  isNeedsFocus,
  sortMarked,
  objectCount,
  isDegenerate,
  pruneDegenerate,
  clusterCount,
  type MarkedPage,
} from '../lib/markedPages';

describe('clusterCount (proximity grouping)', () => {
  const box = (left: number, top: number, w = 10, h = 10, style: object = { type: 'path', stroke: '#f00' }) =>
    ({ left, top, width: w, height: h, ...style });
  it('groups nearby strokes into one mark, keeps far ones separate', () => {
    expect(clusterCount([], 20)).toBe(0);
    expect(clusterCount([box(0, 0)], 20)).toBe(1);
    // Two strokes forming one line (overlapping/adjacent) → 1
    expect(clusterCount([box(0, 0), box(8, 2)], 20)).toBe(1);
    // Two marks far apart → 2
    expect(clusterCount([box(0, 0), box(500, 500)], 20)).toBe(2);
    // Transitive chain a~b~c across the page → 1
    expect(clusterCount([box(0, 0), box(25, 0), box(50, 0)], 20)).toBe(1);
    // Same gap but disconnected pairs → 2
    expect(clusterCount([box(0, 0), box(15, 0), box(300, 0), box(315, 0)], 20)).toBe(2);
  });
  it('never merges different tool or colour, even when overlapping', () => {
    // Same spot, different colour → 2
    expect(clusterCount([box(0, 0, 10, 10, { type: 'path', stroke: '#f00' }), box(2, 2, 10, 10, { type: 'path', stroke: '#00f' })], 20)).toBe(2);
    // Same spot, different tool → 2
    expect(clusterCount([box(0, 0, 10, 10, { type: 'path', stroke: '#f00' }), box(2, 2, 10, 10, { type: 'ellipse', stroke: '#f00' })], 20)).toBe(2);
  });
});

describe('pruneDegenerate (mark count hygiene)', () => {
  it('drops 0×0 shapes and single-point taps, keeps real marks', () => {
    expect(isDegenerate({ width: 0, height: 0 })).toBe(true);              // click, no drag
    expect(isDegenerate({ width: 33, height: 24 })).toBe(false);          // real ellipse
    expect(isDegenerate({ width: 100, height: 40, scaleX: 0, scaleY: 0 })).toBe(true); // scaled to nothing
    expect(isDegenerate({ path: [['M', 1, 1]] })).toBe(true);             // single-point pen tap
    expect(isDegenerate({ path: [['M', 1, 1], ['L', 9, 9]] })).toBe(false);
    const objs = [{ width: 0, height: 0 }, { width: 33, height: 24 }, { width: 0, height: 0 }];
    expect(pruneDegenerate(objs)).toHaveLength(1);
  });
});

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
