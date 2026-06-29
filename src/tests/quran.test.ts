import { describe, it, expect } from 'vitest';
import {
  clampPage,
  getPageImageUrl,
  TOTAL_PAGES,
  TOTAL_JUZ,
  TOTAL_SURAHS,
  SURAH_FIRST_PAGES,
  AYAH_COUNTS,
  JUZ_START_PAGES,
  PAGE_FIRST_AYAH,
  getAyahCount,
  getJuzStartPage,
  getJuzForPage,
  getPageForAyah,
  getAyahsOnPage,
  globalAyahIndex,
  spreadOf,
  spreadUrl,
  parseSpread,
} from '../lib/quran';

describe('clampPage', () => {
  it('clamps below minimum', () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(-100)).toBe(1);
  });

  it('clamps above maximum', () => {
    expect(clampPage(TOTAL_PAGES + 1)).toBe(TOTAL_PAGES);
    expect(clampPage(9999)).toBe(TOTAL_PAGES);
  });

  it('passes valid values through unchanged', () => {
    expect(clampPage(1)).toBe(1);
    expect(clampPage(300)).toBe(300);
    expect(clampPage(TOTAL_PAGES)).toBe(TOTAL_PAGES);
  });
});

describe('getPageImageUrl', () => {
  it('pads page number to 3 digits', () => {
    const url = getPageImageUrl(1);
    expect(url).toContain('001.png');
  });

  it('does not pad 3-digit page numbers', () => {
    const url = getPageImageUrl(604);
    expect(url).toContain('604.png');
  });

  it('returns placeholder URL when no base URL env set', () => {
    const url = getPageImageUrl(1);
    expect(url).toBe('https://placeholder.supabase.co/storage/v1/object/public/quran-pages/tajweed/001.png');
  });
});

describe('SURAH_FIRST_PAGES', () => {
  it('has exactly 114 entries', () => {
    expect(Object.keys(SURAH_FIRST_PAGES)).toHaveLength(114);
  });

  it('surah 1 starts on page 1', () => {
    expect(SURAH_FIRST_PAGES[1]).toBe(1);
  });

  it('surah 2 starts on page 2', () => {
    expect(SURAH_FIRST_PAGES[2]).toBe(2);
  });

  it('surah 114 (last) is on page 604 (last page)', () => {
    expect(SURAH_FIRST_PAGES[114]).toBe(604);
  });

  it('all page values are within valid range 1-604', () => {
    const values = Object.values(SURAH_FIRST_PAGES);
    expect(values.every(v => v >= 1 && v <= TOTAL_PAGES)).toBe(true);
  });

  it('surah numbers are accessible as numeric keys', () => {
    for (let i = 1; i <= 114; i++) {
      expect(SURAH_FIRST_PAGES[i]).toBeDefined();
    }
  });

  it('page numbers are non-decreasing (surahs appear in order)', () => {
    const pages = Array.from({ length: 114 }, (_, i) => SURAH_FIRST_PAGES[i + 1]);
    for (let i = 1; i < pages.length; i++) {
      expect(pages[i]).toBeGreaterThanOrEqual(pages[i - 1]);
    }
  });

  it('known mid-Quran surah positions are correct', () => {
    expect(SURAH_FIRST_PAGES[18]).toBe(293); // Al-Kahf
    expect(SURAH_FIRST_PAGES[36]).toBe(440); // Ya-Sin
    expect(SURAH_FIRST_PAGES[67]).toBe(562); // Al-Mulk
  });
});

describe('AYAH_COUNTS (DATA-3)', () => {
  it('has 114 entries summing to 6236 (Hafs)', () => {
    expect(Object.keys(AYAH_COUNTS)).toHaveLength(TOTAL_SURAHS);
    const total = Object.values(AYAH_COUNTS).reduce((a, b) => a + b, 0);
    expect(total).toBe(6236);
  });

  it('known counts are correct', () => {
    expect(getAyahCount(1)).toBe(7); // Al-Faatiha
    expect(getAyahCount(2)).toBe(286); // Al-Baqara
    expect(getAyahCount(108)).toBe(3); // Al-Kawthar
    expect(getAyahCount(114)).toBe(6); // An-Naas
  });
});

describe('JUZ_START_PAGES (DATA-1)', () => {
  it('has 30 entries within 1-604', () => {
    expect(Object.keys(JUZ_START_PAGES)).toHaveLength(TOTAL_JUZ);
    expect(Object.values(JUZ_START_PAGES).every(p => p >= 1 && p <= TOTAL_PAGES)).toBe(true);
  });

  it('matches Madani Mushaf layout', () => {
    expect(getJuzStartPage(1)).toBe(1);
    expect(getJuzStartPage(2)).toBe(22);
    expect(getJuzStartPage(30)).toBe(582);
  });

  it('start pages are strictly increasing', () => {
    for (let j = 2; j <= TOTAL_JUZ; j++) {
      expect(JUZ_START_PAGES[j]).toBeGreaterThan(JUZ_START_PAGES[j - 1]);
    }
  });
});

describe('getJuzForPage', () => {
  it('maps boundary pages to the right juz', () => {
    expect(getJuzForPage(1)).toBe(1);
    expect(getJuzForPage(21)).toBe(1);
    expect(getJuzForPage(22)).toBe(2);
    expect(getJuzForPage(604)).toBe(30);
  });
});

describe('PAGE_FIRST_AYAH (DATA-2)', () => {
  it('has 604 entries', () => {
    expect(Object.keys(PAGE_FIRST_AYAH)).toHaveLength(TOTAL_PAGES);
  });

  it('page 1 starts at 1:1, page 2 at 2:1', () => {
    expect(PAGE_FIRST_AYAH[1]).toEqual({ surah: 1, ayah: 1 });
    expect(PAGE_FIRST_AYAH[2]).toEqual({ surah: 2, ayah: 1 });
  });
});

describe('globalAyahIndex', () => {
  it('indexes from 1 to 6236', () => {
    expect(globalAyahIndex(1, 1)).toBe(1);
    expect(globalAyahIndex(2, 1)).toBe(8);
    expect(globalAyahIndex(114, 6)).toBe(6236);
  });
});

describe('getPageForAyah', () => {
  it('round-trips with PAGE_FIRST_AYAH', () => {
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      const { surah, ayah } = PAGE_FIRST_AYAH[p];
      expect(getPageForAyah(surah, ayah)).toBe(p);
    }
  });
});

describe('spreadOf (A1, A2)', () => {
  it('pairs pages correctly', () => {
    expect(spreadOf(3)).toEqual([3, 4]);
    expect(spreadOf(4)).toEqual([3, 4]);
    expect(spreadOf(1)).toEqual([1, 2]);
    expect(spreadOf(604)).toEqual([603, 604]);
  });

  it('every page 1..604 maps to exactly one of 302 spreads, no orphan', () => {
    const seen = new Set<string>();
    const pageToSpread: string[] = [];
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      const [low, high] = spreadOf(p);
      expect(high).toBe(low + 1);
      expect(low % 2).toBe(1);
      const key = `${low}-${high}`;
      seen.add(key);
      pageToSpread[p] = key;
    }
    expect(seen.size).toBe(302);
    // no page in two spreads: each page has exactly one mapping (array dense 1..604)
    for (let p = 1; p <= TOTAL_PAGES; p++) expect(pageToSpread[p]).toBeDefined();
  });
});

describe('spreadUrl (A4)', () => {
  it('formats low-high', () => {
    expect(spreadUrl(4)).toBe('3-4');
    expect(spreadUrl(1)).toBe('1-2');
  });
});

describe('parseSpread (A3)', () => {
  it('parses valid spreads', () => {
    expect(parseSpread('3-4')).toEqual([3, 4]);
    expect(parseSpread('1-2')).toEqual([1, 2]);
    expect(parseSpread('603-604')).toEqual([603, 604]);
  });

  it('rejects non-spreads without throwing', () => {
    expect(parseSpread('3')).toBeNull();
    expect(parseSpread('4-3')).toBeNull();
    expect(parseSpread('2-3')).toBeNull(); // low must be odd
    expect(parseSpread('3-5')).toBeNull(); // not adjacent
    expect(parseSpread('garbage')).toBeNull();
    expect(parseSpread('')).toBeNull();
    expect(parseSpread('605-606')).toBeNull(); // out of range
    expect(parseSpread('-1-0')).toBeNull();
  });
});

describe('getAyahsOnPage', () => {
  it('page 1 holds all 7 ayahs of Al-Faatiha', () => {
    const ayahs = getAyahsOnPage(1);
    expect(ayahs).toHaveLength(7);
    expect(ayahs[0]).toEqual({ surah: 1, ayah: 1 });
    expect(ayahs[6]).toEqual({ surah: 1, ayah: 7 });
  });

  it('every ayah lands on exactly one page (6236 total)', () => {
    let count = 0;
    for (let p = 1; p <= TOTAL_PAGES; p++) count += getAyahsOnPage(p).length;
    expect(count).toBe(6236);
  });

  it('first ayah of each page matches PAGE_FIRST_AYAH', () => {
    for (let p = 1; p <= TOTAL_PAGES; p++) {
      expect(getAyahsOnPage(p)[0]).toEqual(PAGE_FIRST_AYAH[p]);
    }
  });
});
