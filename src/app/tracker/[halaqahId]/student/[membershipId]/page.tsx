import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import { getHalaqah } from '@/lib/services/halaqah';
import { getHalaqahMembers } from '@/lib/services/membership';
import { getLogsForMembership } from '@/lib/services/progressLog';
import { computeStreak } from '@/lib/streak';
import StudentAnalytics from '@/components/tracker/StudentAnalytics';

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

  const member = (await getHalaqahMembers(halaqahId)).find((m) => m.id === membershipId);
  if (!member) notFound();

  const logs = await getLogsForMembership(membershipId);
  const streak = computeStreak(logs);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
      <header className="sticky top-0 z-50 border-b"
              style={{ background: 'var(--surface-main)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-e1)' }}>
        <div className="mx-auto flex items-center justify-between px-4 py-3 max-w-2xl">
          <Link href={`/tracker/${halaqahId}`} className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ color: 'var(--text-accent)' }}>←</span>
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{halaqah.name}</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {member.user_id.slice(0, 8)}
          </h1>
          <span className="badge">{streak} day streak</span>
        </div>

        <StudentAnalytics halaqah={halaqah} logs={logs} />

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
    </div>
  );
}
