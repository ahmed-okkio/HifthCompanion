'use client';

import { useMemo } from 'react';
import { useI18n } from '@/components/I18nProvider';
import type { Attendance, Circle, ProgressLog } from '@/types';
import {
  attendanceStats,
  buildHeatmap,
  coverageMap,
  cumulativeTotals,
  weakestSurahs,
} from '@/lib/analytics';
import { getSurahName, TOTAL_JUZ, TOTAL_PAGES } from '@/lib/quran';

/** Per-student analytics panel (M2-1..M2-4). */
export default function StudentAnalytics({
  circle,
  logs,
  attendance = [],
}: {
  circle: Circle;
  logs: ProgressLog[];
  attendance?: Pick<Attendance, 'status'>[];
}) {
  const { t, locale } = useI18n();

  const heatmap = useMemo(() => buildHeatmap(logs), [logs]);
  const totals = useMemo(() => cumulativeTotals(logs), [logs]);
  const weak = useMemo(() => weakestSurahs(logs, circle).slice(0, 5), [logs, circle]);
  const coverage = useMemo(() => coverageMap(logs), [logs]);
  const att = useMemo(() => attendanceStats(attendance), [attendance]);

  const maxCount = Math.max(1, ...heatmap.map((d) => d.count));
  // 7 rows (weekdays) x N columns; column-major fill so each column is a week.
  const weeks = Math.ceil(heatmap.length / 7);

  return (
    <div className="flex flex-col gap-6">
      {/* M2-2 totals */}
      <div className="grid grid-cols-3 gap-3">
        <Stat label={t('analytics.pages')} value={`${totals.pages} / ${TOTAL_PAGES}`} />
        <Stat label={t('analytics.juz')} value={`${totals.juz} / ${TOTAL_JUZ}`} />
        <Stat label={t('analytics.logs')} value={String(totals.logs)} />
      </div>

      {/* M3-4 attendance */}
      {att.marked > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t('analytics.attendanceRate')} value={`${Math.round(att.rate * 100)}%`} />
          <Stat label={t('att.present')} value={String(att.attended)} />
          <Stat label={t('att.absent')} value={String(att.absent)} />
        </div>
      )}

      {/* M2-1 heatmap */}
      <section className="card flex flex-col gap-2" style={{ padding: '16px 18px' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('analytics.heatmap')}</h3>
        <div className="flex gap-[3px] overflow-x-auto" dir="ltr">
          {Array.from({ length: weeks }, (_, w) => (
            <div key={w} className="flex flex-col gap-[3px]">
              {Array.from({ length: 7 }, (_, d) => {
                const day = heatmap[w * 7 + d];
                if (!day) return <span key={d} style={{ width: 12, height: 12 }} />;
                const intensity = day.count === 0 ? 0 : 0.25 + 0.75 * (day.count / maxCount);
                return (
                  <span
                    key={d}
                    title={`${day.date}: ${day.count}`}
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: 3,
                      background: day.count === 0 ? 'var(--border-subtle)' : 'var(--accent)',
                      opacity: day.count === 0 ? 0.4 : intensity,
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {/* M2-3 weakest surahs */}
      <section className="card flex flex-col gap-2" style={{ padding: '16px 18px' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('analytics.weakest')}</h3>
        {weak.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('analytics.noGraded')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {weak.map((s) => (
              <li key={s.surah} className="flex items-center justify-between text-sm" style={{ color: 'var(--text-secondary)' }}>
                <span>{s.surah}. {getSurahName(s.surah, locale)}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {Math.round(s.ratio * 100)}% ({s.negative}/{s.graded})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* M2-4 coverage map */}
      <section className="card flex flex-col gap-2" style={{ padding: '16px 18px' }}>
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{t('analytics.coverage')}</h3>
        <div className="flex flex-wrap gap-[2px]" dir="ltr">
          {Array.from({ length: TOTAL_PAGES }, (_, i) => {
            const c = coverage[i + 1];
            const bg = c.memorized
              ? 'var(--accent)'
              : c.lastRevised
                ? 'var(--text-accent)'
                : 'var(--border-subtle)';
            const op = c.memorized ? 1 : c.lastRevised ? 0.5 : 0.35;
            return (
              <span
                key={i}
                title={`p${i + 1}${c.memorized ? ' · memorized' : ''}${c.lastRevised ? ` · revised ${c.lastRevised}` : ''}`}
                style={{ width: 6, height: 6, borderRadius: 1, background: bg, opacity: op }}
              />
            );
          })}
        </div>
        <div className="flex gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
          <Legend color="var(--accent)" label={t('analytics.memorized')} />
          <Legend color="var(--text-accent)" label={t('analytics.revised')} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card flex flex-col gap-1" style={{ padding: '12px 14px' }}>
      <span className="text-lg font-bold" style={{ color: 'var(--text-accent)' }}>{value}</span>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}
