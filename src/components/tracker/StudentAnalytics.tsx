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
  const { t, locale, fmtNum } = useI18n();

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
        <Stat label={t('analytics.pages')} value={`${fmtNum(totals.pages)} / ${fmtNum(TOTAL_PAGES)}`} />
        <Stat label={t('analytics.juz')} value={`${fmtNum(totals.juz)} / ${fmtNum(TOTAL_JUZ)}`} />
        <Stat label={t('analytics.logs')} value={fmtNum(totals.logs)} />
      </div>

      {/* M3-4 attendance */}
      {att.marked > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <Stat label={t('analytics.attendanceRate')} value={`${fmtNum(Math.round(att.rate * 100))}%`} />
          <Stat label={t('att.present')} value={fmtNum(att.attended)} />
          <Stat label={t('att.absent')} value={fmtNum(att.absent)} />
        </div>
      )}

      {/* M2-1 heatmap */}
      <section className="card flex flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold text-primary">{t('analytics.heatmap')}</h3>
        <div className="flex gap-0.75 overflow-x-auto" dir="ltr">
          {Array.from({ length: weeks }, (_, w) => (
            <div key={w} className="flex flex-col gap-0.75">
              {Array.from({ length: 7 }, (_, d) => {
                const day = heatmap[w * 7 + d];
                if (!day) return <span className="w-3 h-3" key={d} />;
                const intensity = day.count === 0 ? 0 : 0.25 + 0.75 * (day.count / maxCount);
                return (
                  <span className={`size-3 rounded-xs ${day.count === 0 ? 'bg-subtle' : 'bg-accent'}`}
                    key={d}
                    title={`${day.date}: ${day.count}`}
                    // eslint-disable-next-line shadcn/no-inline-styles -- opacity from data intensity
                    style={{ opacity: day.count === 0 ? 0.4 : intensity }}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </section>

      {/* M2-3 weakest surahs */}
      <section className="card flex flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold text-primary">{t('analytics.weakest')}</h3>
        {weak.length === 0 ? (
          <p className="text-xs text-muted">{t('analytics.noGraded')}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {weak.map((s) => (
              <li key={s.surah} className="flex items-center justify-between text-sm text-secondary">
                <span>{fmtNum(s.surah)}. {getSurahName(s.surah, locale)}</span>
                <span className="text-xs text-muted">
                  {fmtNum(Math.round(s.ratio * 100))}% ({fmtNum(s.negative)}/{fmtNum(s.graded)})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* M2-4 coverage map */}
      <section className="card flex flex-col gap-2 p-4">
        <h3 className="text-sm font-semibold text-primary">{t('analytics.coverage')}</h3>
        <div className="flex flex-wrap gap-0.5" dir="ltr">
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
                className="size-1.5 rounded-xs"
                // eslint-disable-next-line shadcn/no-inline-styles -- colour/opacity from page coverage data
                style={{ background: bg, opacity: op }}
              />
            );
          })}
        </div>
        <div className="flex gap-4 text-xs text-muted">
          <Legend color="var(--accent)" label={t('analytics.memorized')} />
          <Legend color="var(--text-accent)" label={t('analytics.revised')} />
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card flex flex-col gap-1 py-3 px-4">
      <span className="text-lg font-bold text-(--text-accent)">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      {/* eslint-disable-next-line shadcn/no-inline-styles -- swatch colour passed by caller */}
      <span className="size-2 inline-block rounded-xs" style={{ background: color }} />
      {label}
    </span>
  );
}
