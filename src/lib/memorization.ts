import type { MemorizedRange } from '@/types';
import { AYAH_COUNTS, TOTAL_SURAHS, TOTAL_JUZ, getAyahCount } from '@/lib/quran';
import juzStartAyahData from '@/data/juzStartAyah.json';

/** First ayah (surah:ayah) of each juz (1–30). Canonical ayah-precise boundaries. */
const JUZ_START_AYAH: Record<number, { surah: number; ayah: number }> =
  juzStartAyahData as Record<number, { surah: number; ayah: number }>;

/** True iff every range is a valid ayah span. Empty list is valid. */
export function validate(ranges: MemorizedRange[]): boolean {
  return ranges.every(
    (r) =>
      r.surah >= 1 &&
      r.surah <= TOTAL_SURAHS &&
      r.from >= 1 &&
      r.from <= r.to &&
      r.to <= (AYAH_COUNTS[r.surah] ?? 0)
  );
}

/** Sort by surah then from; merge overlapping OR adjacent (to+1 >= next.from)
 *  ranges within the same surah. */
export function normalize(ranges: MemorizedRange[]): MemorizedRange[] {
  const sorted = [...ranges].sort((a, b) => a.surah - b.surah || a.from - b.from);
  const out: MemorizedRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && last.surah === r.surah && r.from <= last.to + 1) {
      last.to = Math.max(last.to, r.to);
    } else {
      out.push({ ...r });
    }
  }
  return out;
}

/** base minus minus: remove the ayahs in `minus` from `base`, splitting ranges
 *  where a gap falls inside one. Same-surah only; result normalized. */
export function subtractRanges(base: MemorizedRange[], minus: MemorizedRange[]): MemorizedRange[] {
  const out: MemorizedRange[] = [];
  for (const b of normalize(base)) {
    let segs: MemorizedRange[] = [{ ...b }];
    for (const m of minus) {
      if (m.surah !== b.surah) continue;
      const next: MemorizedRange[] = [];
      for (const s of segs) {
        if (m.to < s.from || m.from > s.to) { next.push(s); continue; } // no overlap
        if (m.from > s.from) next.push({ surah: s.surah, from: s.from, to: m.from - 1 });
        if (m.to < s.to) next.push({ surah: s.surah, from: m.to + 1, to: s.to });
      }
      segs = next;
    }
    out.push(...segs);
  }
  return normalize(out);
}

/** Surah+ayah ranges covered by a juz (1–30), from canonical ayah-precise
 *  boundaries. Page-based derivation over-included surahs that merely shared a
 *  boundary page (e.g. Al-Jathiyah leaking into juz 26). */
export function juzToRanges(juz: number): MemorizedRange[] {
  const startRef = JUZ_START_AYAH[juz];
  if (!startRef) return [];
  // Last ayah of this juz = the ayah just before the next juz's first (or the
  // very last ayah of the Qur'an for juz 30).
  const next = JUZ_START_AYAH[juz + 1];
  const endRef =
    juz >= TOTAL_JUZ || !next
      ? { surah: TOTAL_SURAHS, ayah: getAyahCount(TOTAL_SURAHS) }
      : next.ayah > 1
        ? { surah: next.surah, ayah: next.ayah - 1 }
        : { surah: next.surah - 1, ayah: getAyahCount(next.surah - 1) };

  const ranges: MemorizedRange[] = [];
  for (let s = startRef.surah; s <= endRef.surah; s++) {
    const from = s === startRef.surah ? startRef.ayah : 1;
    const to = s === endRef.surah ? endRef.ayah : getAyahCount(s);
    ranges.push({ surah: s, from, to });
  }
  return normalize(ranges);
}
