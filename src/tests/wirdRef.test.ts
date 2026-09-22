import { describe, it, expect } from 'vitest';
import { openingRef, closingRef } from '@/components/wird/ref';

// Surah-name spellings are asserted exactly as getSurahName returns them
// (from the real data files) — the contract's diacritic spellings are the
// same references, but the test must match the shipped strings.

describe('opening reference (G1, G5)', () => {
  it('pages 301–320 open at Al-Kahf 62', () => {
    expect(openingRef(301).label).toBe('Al-Kahf 62');
  });

  it('page 297 opens at Al-Kahf 28', () => {
    expect(openingRef(297).label).toBe('Al-Kahf 28');
  });

  it('pages 578–584 open at Al-Qiyaama 20', () => {
    expect(openingRef(578).label).toBe('Al-Qiyaama 20');
  });

  it('a 293–304 scope opens at Al-Israa 105, not Al-Kahf 1 (G5)', () => {
    expect(openingRef(293).label).toBe('Al-Israa 105');
  });
});

describe('closing reference (G2, G4)', () => {
  it('pages 301–320 close at Taa-Haa 125', () => {
    expect(closingRef(320).label).toBe('Taa-Haa 125');
  });

  it('page 297 closes at Al-Kahf 34', () => {
    expect(closingRef(297).label).toBe('Al-Kahf 34');
  });

  it("pages 578–584 close at An-Naazi'aat 46 (rolls back across the sūra boundary)", () => {
    expect(closingRef(584).label).toBe("An-Naazi'aat 46");
  });

  it('page 604 closes at An-Naas 6', () => {
    expect(closingRef(604).label).toBe('An-Naas 6');
  });
});

describe('no bare colon reference (G3)', () => {
  it('labels are name + ayah, never surah:ayah', () => {
    for (const label of [openingRef(301).label, closingRef(320).label, closingRef(604).label]) {
      expect(label).not.toMatch(/^\d+:\d+$/);
      expect(label).toMatch(/^\D.*\s\d+$/);
    }
  });
});
