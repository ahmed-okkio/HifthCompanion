'use client';

/**
 * WirdHeatmap — a GitHub-style consistency grid for one wird: 7 day-rows
 * (Mon–Sun, labelled on alternate rows) × N week-columns, a cell filled when
 * that wird was completed on that date. Cells are flex/aspect-ratio squares so
 * the whole grid scales to the container width — mobile-friendly, no scroll.
 */

import { useI18n } from '@/components/I18nProvider';

const DAY_MS = 86_400_000;
const localISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function WirdHeatmap({ doneDates, weeks = 16 }: { doneDates: string[]; weeks?: number }) {
  const { locale, t } = useI18n();
  const done = new Set(doneDates);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = localISO(today);
  // Monday-of-this-week, then go back so the grid ends on the current week.
  const dow = (today.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
  const thisMonday = new Date(today.getTime() - dow * DAY_MS);
  const start = new Date(thisMonday.getTime() - (weeks - 1) * 7 * DAY_MS);

  // Narrow weekday letters from Intl (locale-aware); label alternate rows only.
  const nf = new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', { weekday: 'narrow' });
  const dayLabel = (row: number) =>
    row % 2 === 0 ? nf.format(new Date(thisMonday.getTime() + row * DAY_MS)) : '';

  const cellBase: React.CSSProperties = {
    aspectRatio: '1', minWidth: 0, borderRadius: 3,
  };

  // Row-major fill: [label, cell×weeks] per day-row.
  const items: React.ReactNode[] = [];
  for (let row = 0; row < 7; row += 1) {
    items.push(
      <span
        key={`l${row}`}
        aria-hidden
        style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted)', textAlign: 'end', alignSelf: 'center', lineHeight: 1 }}
      >
        {dayLabel(row)}
      </span>,
    );
    for (let col = 0; col < weeks; col += 1) {
      const d = new Date(start.getTime() + (col * 7 + row) * DAY_MS);
      const iso = localISO(d);
      const future = iso > todayIso;
      const filled = done.has(iso);
      items.push(
        <span
          key={`${row}-${col}`}
          title={iso}
          data-done={filled || undefined}
          style={{
            ...cellBase,
            background: filled ? 'var(--green-600)' : 'var(--neutral-200)',
            opacity: future ? 0 : 1, // out-of-range future days: hold the slot, draw nothing
          }}
        />,
      );
    }
  }

  return (
    <div aria-label={t('wird.history')}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `14px repeat(${weeks}, 1fr)`,
          gridAutoRows: '1fr',
          gap: 3,
          alignItems: 'stretch',
        }}
      >
        {items}
      </div>
    </div>
  );
}
