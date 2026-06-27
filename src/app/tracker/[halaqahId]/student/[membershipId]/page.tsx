import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getHalaqah } from '@/lib/services/halaqah';
import { getHalaqahMembersWithProfiles } from '@/lib/services/membership';
import { displayName } from '@/lib/displayName';
import { getMyChrome } from '@/lib/services/profile';
import { getLogsForMembership } from '@/lib/services/progressLog';
import { getAttendanceForMembership } from '@/lib/services/attendance';
import { computeStreak } from '@/lib/streak';
import StudentAnalytics from '@/components/tracker/StudentAnalytics';
import { Avatar } from '@/components/tracker/ui';

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ halaqahId: string; membershipId: string }>;
}) {
  const { halaqahId, membershipId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const halaqah = await getHalaqah(halaqahId);
  if (!halaqah || halaqah.teacher_id !== user.id) notFound();

  const member = (await getHalaqahMembersWithProfiles(halaqahId)).find((m) => m.id === membershipId);
  if (!member) notFound();

  const logs = await getLogsForMembership(membershipId);
  const attendance = await getAttendanceForMembership(membershipId);
  const streak = computeStreak(logs);

  const account = await getMyChrome(user);

  return (
    <AppShell breadcrumb={halaqah.name} user={account}>
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 animate-fade-in flex flex-col gap-4">
        <div className="card flex items-center justify-between gap-3" style={{ padding: '14px 16px' }}>
          <div className="flex items-center gap-3 min-w-0">
            <Avatar seed={displayName(member)} size={44} />
            <div className="flex flex-col min-w-0">
              <h1 className="text-base font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                {displayName(member)}
              </h1>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {member.status}
              </span>
            </div>
          </div>
          <span className="badge" style={{ background: 'var(--accent-muted)' }}>🔥 {streak}</span>
        </div>

        <StudentAnalytics halaqah={halaqah} logs={logs} attendance={attendance} />

        {logs.map((l) => (
          <div key={l.id} className="card flex flex-col gap-1" style={{ padding: '12px 16px' }}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                {l.log_type} · p{l.page_start}–{l.page_end}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{l.log_date}</span>
            </div>
            {l.student_status && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{l.student_status}</span>}
            {l.reviewed_at && (
              <span className="text-xs" style={{ color: 'var(--text-accent)' }}>
                Reviewed{l.teacher_status ? `: ${l.teacher_status}` : ''}
                {l.teacher_comment ? ` — ${l.teacher_comment}` : ''}
              </span>
            )}
            {member.shared_set_id && (
              <a href={`/reader/${l.page_start}?set=${member.shared_set_id}`}
                 className="text-xs" style={{ color: 'var(--text-accent)' }}>
                View page {l.page_start} →
              </a>
            )}
          </div>
        ))}
      </main>
    </AppShell>
  );
}
