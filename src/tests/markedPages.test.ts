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
  clusterColors,
  markColor,
  groupBySurah,
  surahGroupKey,
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

describe('clusterColors (per-colour breakdown)', () => {
  const box = (left: number, top: number, style: object) => ({ left, top, width: 10, height: 10, ...style });
  it('splits the same clusters clusterCount counts, so the two always agree', () => {
    const objs = [
      // One red mark drawn as two nearby strokes…
      box(0, 0, { type: 'path', stroke: '#ef4444' }),
      box(8, 2, { type: 'path', stroke: '#ef4444' }),
      // …a second red mark elsewhere…
      box(400, 0, { type: 'path', stroke: '#ef4444' }),
      // …and one blue, overlapping the first (different colour never merges).
      box(2, 2, { type: 'path', stroke: '#3b82f6' }),
    ];
    expect(clusterColors(objs, 20)).toEqual({ '#ef4444': 2, '#3b82f6': 1 });
    const colors = clusterColors(objs, 20);
    const summed = Object.values(colors).reduce((a, b) => a + b, 0);
    expect(summed).toBe(clusterCount(objs, 20));
  });
  it('counts a highlighter and a pen stroke of one colour as that one colour', () => {
    // The highlighter bakes its opacity into the stroke; both are yellow marks.
    const objs = [
      box(0, 0, { type: 'path', stroke: '#f59e0b' }),
      box(300, 0, { type: 'path', stroke: 'rgba(245,158,11,0.4)' }),
    ];
    expect(markColor({ stroke: 'rgba(245, 158, 11, 0.4)' })).toBe('#f59e0b');
    expect(clusterColors(objs, 20)).toEqual({ '#f59e0b': 2 });
  });
  it('reads the text tool from fill and ignores transparent shape fills', () => {
    expect(markColor({ type: 'ellipse', stroke: '#22c55e', fill: 'transparent' })).toBe('#22c55e');
    expect(markColor({ type: 'i-text', fill: '#8b5cf6' })).toBe('#8b5cf6');
    expect(markColor({ type: 'path', fill: 'transparent' })).toBeNull();
    expect(clusterColors([], 20)).toEqual({});
  });
});

describe('groupBySurah (mushaf-order grouping)', () => {
  it('groups pages under their surah, mushaf order in and out, flagging the focus group', () => {
    // Page 4 and 22 are Al-Baqarah (2); 51 is Aal-i-Imran (3); 298 is Al-Kahf (18).
    const rows: MarkedPage[] = [
      { page: 298, count: 3 },
      { page: 22, count: 7 },
      { page: 4, count: 3 },
      { page: 51, count: 5 },
    ];
    const groups = groupBySurah(rows);
    expect(groups.map(g => g.surahs)).toEqual([[2], [3], [18]]);
    expect(groups[0].pages.map(p => p.page)).toEqual([4, 22]);
    expect(groups[0].count).toBe(10);
    // Page 22 ties the set max, so only its card carries the flag.
    expect(groups.map(g => g.hasFocus)).toEqual([true, false, false]);
    expect(groupBySurah([])).toEqual([]);
  });

  it('gives a page carrying a surah boundary its own group, naming both surahs', () => {
    // An-Nisa (4) ends partway down page 106, where Al-Ma'ida (5) begins.
    expect(surahGroupKey(105)).toBe('4');
    expect(surahGroupKey(106)).toBe('4,5');
    expect(surahGroupKey(107)).toBe('5');
    const groups = groupBySurah([
      { page: 107, count: 1 },
      { page: 105, count: 2 },
      { page: 106, count: 3 },
    ]);
    // Ordered by first page — 4,5 sorts between 4 and 5, which surah number alone can't do.
    expect(groups.map(g => g.surahs)).toEqual([[4], [4, 5], [5]]);
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
