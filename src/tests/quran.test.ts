import { describe, it, expect } from 'vitest';
import { clampPage, getPageImageUrl, TOTAL_PAGES } from '../lib/quran';

describe('quran utils', () => {
  it('should clamp pages correctly', () => {
    expect(clampPage(0)).toBe(1);
    expect(clampPage(1)).toBe(1);
    expect(clampPage(300)).toBe(300);
    expect(clampPage(TOTAL_PAGES)).toBe(TOTAL_PAGES);
    expect(clampPage(TOTAL_PAGES + 1)).toBe(TOTAL_PAGES);
  });

  it('should generate correct image URL', () => {
    expect(getPageImageUrl(1)).toBe('https://placeholder.supabase.co/storage/v1/object/public/quran-pages/tajweed/001.png');
    expect(getPageImageUrl(604)).toBe('https://placeholder.supabase.co/storage/v1/object/public/quran-pages/tajweed/604.png');
  });
});
