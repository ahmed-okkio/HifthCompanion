import { describe, it, expect } from 'vitest';
import { clampPage, getPageImageUrl, TOTAL_PAGES, SURAH_FIRST_PAGES } from '../lib/quran';

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
