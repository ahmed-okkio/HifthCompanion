import { getCovering } from '@/lib/services/substitution';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { SectionTitle, DateChip } from './ui';

/**
 * Substitute's Covering view (G1/G2/G4). Lists the sessions the current user is
 * actively covering — separate from their own circle. Renders nothing when the
 * caller covers nobody (G4); the RPC only returns active, self-covered rows so
 * an uncovered student can never leak here.
 *
 * G2: each row deep-links to the covered student's scoped page. circle_id comes
 * from the RPC (20260724000001) — a sub cannot read circle/membership (D4/D5).
 */
export default async function CoveringSection() {
  const rows = await getCovering();
  if (rows.length === 0) return null; // G4: no coverage → no section

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="flex flex-col gap-2 mb-6">
      <SectionTitle
        trailing={<span className="badge" style={{ fontSize: 10 }}>{dict['subs.badge']}</span>}
      >
        {dict['subs.covering']}
      </SectionTitle>
      <div className="flex flex-col gap-2">
        {rows.map((r) => (
          <a
            key={`${r.membership_id}-${r.scheduled_at}`}
            href={`/tracker/${r.circle_id}/student/${r.membership_id}`}
            className="card flex items-center gap-3"
            style={{ padding: '10px 14px' }}
          >
            <DateChip iso={r.scheduled_at} locale={locale} />
            <div className="flex flex-col gap-0.5 min-w-0 flex-1">
              <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {r.student_name} · {r.circle_name}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {fmt(r.scheduled_at)} · {dict['subs.awayTeacher'].replace('{teacher}', r.teacher_name)}
              </span>
            </div>
            <span className="text-xs shrink-0" style={{ color: 'var(--text-accent)' }}>{dict['subs.openStudent']}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
