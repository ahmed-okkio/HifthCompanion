import { describe, it, expect } from 'vitest';
import {
  buildHeatmap,
  cumulativeTotals,
  weakestSurahs,
  coverageMap,
  rollup,
  attendanceStats,
  logToMemorizedRanges,
  rangesTotals,
} from '../lib/analytics';
import type { Circle, ProgressLog } from '../types';

// Mirror buildHeatmap's date derivation (local midnight -> toISOString) so the
// comparison is timezone-stable: buildHeatmap's last cell is daysAgo(0).
const daysAgo = (n: number) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};
const today = () => daysAgo(0);

function log(p: Partial<ProgressLog>): ProgressLog {
  return {
    id: Math.random().toString(36).slice(2),
    membership_id: 'm1',
    homework_id: null,
    log_date: today(),
    log_type: 'memorization',
    page_start: 1,
    page_end: 1,
    surah: null,
    ayah_start: null,
    ayah_end: null,
    student_status: null,
    student_notes: null,
    teacher_status: null,
    teacher_comment: null,
    reviewed_at: null,
    created_at: today(),
    updated_at: today(),
    ...p,
  };
}

// D14: teacher_status polarity is still per-circle config; log_type→role is now
// a hardcoded enum map (D8), so no log_types config is needed here anymore.
const circle: Pick<Circle, 'teacher_statuses'> = {
  teacher_statuses: [
    { label: 'Excellent', polarity: 'positive' },
    { label: 'Needs work', polarity: 'negative' },
    { label: 'OK', polarity: 'neutral' },
  ],
};

describe('buildHeatmap', () => {
  it('returns one entry per day, oldest first, ending today', () => {
    const hm = buildHeatmap([], 7);
    expect(hm).toHaveLength(7);
    expect(hm[6].date).toBe(today());
    expect(hm[0].date).toBe(daysAgo(6));
  });

  it('counts logs by log_date', () => {
    const hm = buildHeatmap([log({ log_date: today() }), log({ log_date: today() }), log({ log_date: daysAgo(1) })], 7);
    expect(hm[6].count).toBe(2);
    expect(hm[5].count).toBe(1);
    expect(hm[0].count).toBe(0);
  });
});

describe('cumulativeTotals', () => {
  it('counts distinct pages and juz, dedupes overlaps', () => {
    const t = cumulativeTotals([
      log({ page_start: 1, page_end: 3 }),
      log({ page_start: 2, page_end: 4 }), // overlaps 2,3
    ]);
    expect(t.pages).toBe(4); // 1,2,3,4
    expect(t.juz).toBe(1); // all juz 1
    expect(t.logs).toBe(2);
  });

  it('counts juz across boundaries', () => {
    const t = cumulativeTotals([log({ page_start: 21, page_end: 22 })]); // juz1 + juz2
    expect(t.pages).toBe(2);
    expect(t.juz).toBe(2);
  });
});

describe('logToMemorizedRanges + rangesTotals (hifth credit)', () => {
  const log = (o: Partial<ProgressLog>): ProgressLog => ({
    id: 'x', membership_id: 'm', homework_id: null, log_date: '2026-01-01',
    log_type: 'memorization', page_start: 1, page_end: 1, surah: null,
    ayah_start: null, ayah_end: null, student_status: null, student_notes: null,
    teacher_status: null, teacher_comment: null, reviewed_at: null, created_at: '', updated_at: '',
    ...o,
  } as ProgressLog);

  it('maps an explicit surah+ayah scope 1:1', () => {
    expect(logToMemorizedRanges(log({ surah: 2, ayah_start: 5, ayah_end: 20 })))
      .toEqual([{ surah: 2, from: 5, to: 20 }]);
  });

  it('normalizes a reversed ayah range', () => {
    expect(logToMemorizedRanges(log({ surah: 2, ayah_start: 20, ayah_end: 5 })))
      .toEqual([{ surah: 2, from: 5, to: 20 }]);
  });

  it('decomposes a page-only log into per-surah ranges', () => {
    // Page 1 is Al-Fatiha (surah 1, ayahs 1..7).
    expect(logToMemorizedRanges(log({ page_start: 1, page_end: 1 })))
      .toEqual([{ surah: 1, from: 1, to: 7 }]);
  });

  it('counts distinct surahs and juz over ranges', () => {
    const t = rangesTotals([{ surah: 1, from: 1, to: 7 }, { surah: 2, from: 1, to: 5 }]);
    expect(t.surahs).toBe(2);
    expect(t.juz).toBe(1); // both sit in juz 1
  });
});

describe('weakestSurahs', () => {
  it('ignores ungraded logs', () => {
    const scores = weakestSurahs([log({ surah: 2, teacher_status: 'Needs work' })], circle);
    expect(scores).toHaveLength(0); // not reviewed
  });

  it('scores negative ratio per surah, weakest first', () => {
    const scores = weakestSurahs(
      [
        log({ surah: 2, reviewed_at: today(), teacher_status: 'Needs work' }),
        log({ surah: 2, reviewed_at: today(), teacher_status: 'Excellent' }),
        log({ surah: 3, reviewed_at: today(), teacher_status: 'Needs work' }),
      ],
      circle,
    );
    expect(scores[0]).toMatchObject({ surah: 3, ratio: 1 });
    expect(scores[1]).toMatchObject({ surah: 2, graded: 2, negative: 1, ratio: 0.5 });
  });

  it('derives surah from page range when surah field absent', () => {
    const scores = weakestSurahs(
      [log({ page_start: 2, page_end: 2, reviewed_at: today(), teacher_status: 'Needs work' })],
      circle,
    );
    expect(scores[0].surah).toBe(2); // page 2 = Al-Baqara
  });
});

// B2: type→role map is hardcoded — memorization paints coverage; both revision
// types drive recency; no read role exists.
describe('coverageMap (B2)', () => {
  it('memorization paints; general/targeted revision record recency', () => {
    const cov = coverageMap([
      log({ log_type: 'memorization', page_start: 5, page_end: 5 }),
      log({ log_type: 'general_revision', page_start: 5, page_end: 5, log_date: daysAgo(2) }),
      log({ log_type: 'targeted_revision', page_start: 5, page_end: 5, log_date: today() }),
    ]);
    expect(cov[5].memorized).toBe(true);
    expect(cov[5].lastRevised).toBe(today()); // most recent revise wins
    expect(cov[10].memorized).toBe(false); // untouched page
    expect(cov[10].lastRevised).toBeNull();
  });

  it('a revision-only page is not marked memorized', () => {
    const cov = coverageMap([log({ log_type: 'general_revision', page_start: 20, page_end: 20 })]);
    expect(cov[20].memorized).toBe(false);
    expect(cov[20].lastRevised).toBe(today());
  });
});

describe('rollup', () => {
  it('summarizes per membership, sorted by pages, counts pending', () => {
    const byM = new Map<string, ProgressLog[]>([
      ['a', [log({ page_start: 1, page_end: 1 })]],
      ['b', [log({ page_start: 1, page_end: 5 }), log({ page_start: 6, page_end: 6, reviewed_at: today() })]],
    ]);
    const r = rollup(byM);
    expect(r[0].membershipId).toBe('b');
    expect(r[0].totals.pages).toBe(6);
    expect(r[0].pending).toBe(1);
    expect(r[1].pending).toBe(1);
  });
});

describe('attendanceStats (M3-4)', () => {
  const a = (status: string) => ({ status } as any);

  it('counts present and late as attended; excused leaves the denominator', () => {
    const s = attendanceStats([a('present'), a('late'), a('absent'), a('excused')]);
    expect(s.marked).toBe(4);
    expect(s.attended).toBe(2);
    expect(s.absent).toBe(1);
    expect(s.excused).toBe(1);
    // denom = 4 - 1 excused = 3; attended 2 -> 0.666…
    expect(s.rate).toBeCloseTo(2 / 3);
  });

  it('rate is 0 when nothing countable', () => {
    expect(attendanceStats([]).rate).toBe(0);
    expect(attendanceStats([a('excused')]).rate).toBe(0);
  });
});
