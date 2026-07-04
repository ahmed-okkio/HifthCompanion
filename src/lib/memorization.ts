import type { MemorizedRange } from '@/types';
import { AYAH_COUNTS, TOTAL_SURAHS, juzPageBounds, getAyahsOnPage } from '@/lib/quran';

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

/** Surah+ayah ranges covered by a juz (1–30), derived from its page bounds. */
export function juzToRanges(juz: number): MemorizedRange[] {
  const [start, end] = juzPageBounds(juz);
  const ranges: MemorizedRange[] = [];
  for (let p = start; p <= end; p++) {
    for (const { surah, ayah } of getAyahsOnPage(p)) {
      ranges.push({ surah, from: ayah, to: ayah });
    }
  }
  return normalize(ranges);
}
