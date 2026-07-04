import { describe, it, expect } from 'vitest';
import { homeworkStatus, wholeSurahPages, aggregateStatus, groupHomework, homeworkTarget } from '../lib/homework';
import { SURAH_FIRST_PAGES, TOTAL_PAGES, JUZ_START_PAGES, juzPageBounds } from '../lib/quran';
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

describe('juzPageBounds', () => {
  it('juz J spans JUZ_START_PAGES[J] .. JUZ_START_PAGES[J+1]-1', () => {
    expect(juzPageBounds(1)).toEqual([JUZ_START_PAGES[1], JUZ_START_PAGES[2] - 1]);
    expect(juzPageBounds(15)).toEqual([JUZ_START_PAGES[15], JUZ_START_PAGES[16] - 1]);
  });
  it('juz 30 ends on page 604', () => {
    expect(juzPageBounds(30)).toEqual([JUZ_START_PAGES[30], TOTAL_PAGES]);
    expect(juzPageBounds(30)[1]).toBe(604);
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

describe('homeworkTarget', () => {
  const r = (o: Partial<Homework>): Homework => o as Homework;
  it('single surah with ayah range', () => {
    expect(homeworkTarget([r({ surah: 2, ayah_start: 1, ayah_end: 20 })], 'en', 'Juz')).toBe('Al-Baqara 1-20');
  });
  it('whole surah (null ayahs) expands to 1-count', () => {
    // Al-Fatiha = 7 ayahs
    expect(homeworkTarget([r({ surah: 1, ayah_start: null, ayah_end: null })], 'en', 'Juz')).toBe('Al-Faatiha 1-7');
  });
  it('multiple surahs → first - last', () => {
    expect(homeworkTarget([r({ surah: 4 }), r({ surah: 2 })], 'en', 'Juz')).toBe('Al-Baqara - An-Nisaa');
  });
  it('page-only rows → single juz', () => {
    expect(homeworkTarget([r({ surah: null, page_start: 582, page_end: 604 })], 'en', 'Juz')).toBe('Juz 30');
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
