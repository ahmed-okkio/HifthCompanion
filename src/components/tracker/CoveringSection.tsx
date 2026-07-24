import Link from 'next/link';
import { getCovering } from '@/lib/services/substitution';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { SectionTitle, Avatar, Chevron } from './ui';

/**
 * Substitute's Covering view (G1/G2/G4) — deliberately shaped like the teacher's
 * own roster: one card per covered STUDENT (not per instant), avatar + name,
 * clicking through to their scoped page. The covered times ride along as chips
 * on the card, since a run of sessions for one student is the common case.
 *
 * G2: circle_id comes from the RPC — a sub cannot read circle/membership (D4/D5).
 * G4: renders nothing when the caller covers nobody.
 */
export default async function CoveringSection() {
  const rows = await getCovering();
  if (rows.length === 0) return null;

  const locale = await getLocale();
  const dict = getDictionary(locale);
  const chip = (iso: string) =>
    new Date(iso).toLocaleString(locale, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  // One card per student; the RPC is already ordered by scheduled_at, so each
  // group's instants stay soonest-first.
  const byStudent = new Map<string, typeof rows>();
  for (const r of rows) {
    const g = byStudent.get(r.membership_id);
    if (g) g.push(r); else byStudent.set(r.membership_id, [r]);
  }

  return (
    <div className="flex flex-col gap-2 mb-6">
      <SectionTitle
        trailing={<span className="badge" style={{ fontSize: 10 }}>{dict['subs.badge']}</span>}
      >
        {dict['subs.covering']}
      </SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2">
        {[...byStudent.values()].map((group) => {
          const r = group[0];
          const name = r.student_name || dict['tracker.roleStudent'];
          return (
            <div key={r.membership_id} className="card flex flex-col gap-3" style={{ padding: '14px 16px' }}>
              <Link href={`/tracker/${r.circle_id}/student/${r.membership_id}`} className="flex items-center gap-2 min-w-0">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Avatar seed={name} size={40} />
                  <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                    <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{name}</span>
                    <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                      {r.circle_name} · {dict['subs.awayTeacher'].replace('{teacher}', r.teacher_name)}
                    </span>
                  </div>
                </div>
                <Chevron />
              </Link>
              <div className="flex flex-wrap gap-1">
                {group.map((s) => (
                  <span key={s.scheduled_at} className="badge badge-muted" style={{ fontSize: 10 }}>
                    {chip(s.scheduled_at)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
