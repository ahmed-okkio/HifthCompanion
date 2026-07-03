import { describe, it, expect } from 'vitest';
import { homeworkStatus, wholeSurahPages, aggregateStatus, groupHomework } from '../lib/homework';
import { SURAH_FIRST_PAGES, TOTAL_PAGES } from '../lib/quran';
import type { Homework } from '../types';

describe('homeworkStatus (D10)', () => {
  const today = '2026-07-01';

  it('open when no deadline', () => {
    expect(homeworkStatus({ deadline: null }, 0, today)).toBe('open');
  });
  it('open when deadline today or future, regardless of linked logs', () => {
    expect(homeworkStatus({ deadline: today }, 0, today)).toBe('open');
    expect(homeworkStatus({ deadline: '2026-07-05' }, 3, today)).toBe('open');
  });
  it('missed when past deadline with no linked logs', () => {
    expect(homeworkStatus({ deadline: '2026-06-30' }, 0, today)).toBe('missed');
  });
  it('completed when past deadline with at least one linked log', () => {
    expect(homeworkStatus({ deadline: '2026-06-30' }, 1, today)).toBe('completed');
  });
});

describe('wholeSurahPages (H6)', () => {
  it('surah S spans SURAH_FIRST_PAGES[S] .. SURAH_FIRST_PAGES[S+1]-1', () => {
    expect(wholeSurahPages(1)).toEqual([SURAH_FIRST_PAGES[1], SURAH_FIRST_PAGES[2] - 1]);
    expect(wholeSurahPages(2)).toEqual([2, SURAH_FIRST_PAGES[3] - 1]);
    expect(wholeSurahPages(36)).toEqual([SURAH_FIRST_PAGES[36], SURAH_FIRST_PAGES[37] - 1]);
  });
  it('last surah (114) ends on page 604', () => {
    expect(wholeSurahPages(114)).toEqual([SURAH_FIRST_PAGES[114], TOTAL_PAGES]);
    expect(wholeSurahPages(114)[1]).toBe(604);
  });
});

describe('aggregateStatus (H4)', () => {
  it('open if any row open', () => {
    expect(aggregateStatus(['completed', 'open'])).toBe('open');
  });
  it('completed only when all rows completed', () => {
    expect(aggregateStatus(['completed', 'completed'])).toBe('completed');
  });
  it('missed when none open and not all completed', () => {
    expect(aggregateStatus(['missed', 'completed'])).toBe('missed');
  });
});

describe('groupHomework (H3/H5)', () => {
  const row = (id: string, group_id: string | null): Homework =>
    ({ id, group_id } as Homework);
  it('rows sharing group_id form one card; legacy null rows are solo', () => {
    const groups = groupHomework([row('a', 'g1'), row('b', 'g1'), row('c', null)]);
    expect(groups).toHaveLength(2);
    expect(groups[0].items.map((h) => h.id)).toEqual(['a', 'b']);
    expect(groups[1].items.map((h) => h.id)).toEqual(['c']);
  });
});
