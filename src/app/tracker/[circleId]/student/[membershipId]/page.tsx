import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getCircle } from '@/lib/services/circle';
import { getCircleMembersWithProfiles, getStudentDefaultSetId } from '@/lib/services/membership';
import { getLogsForMembership } from '@/lib/services/progressLog';
import { getSessions } from '@/lib/services/sessions';
import { listHomework } from '@/lib/services/homework';
import { listNotes } from '@/lib/services/membershipNotes';
import { getMyChrome, getStudentMemorization } from '@/lib/services/profile';
import { rangesTotals } from '@/lib/analytics';
import TeacherStudent from '@/components/tracker/TeacherStudent';
import { BackButton } from '@/components/tracker/ui';
import { displayName } from '@/lib/displayName';

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ circleId: string; membershipId: string }>;
}) {
  const { circleId, membershipId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const circle = await getCircle(circleId);
  if (!circle || circle.teacher_id !== user.id) notFound();

  const member = (await getCircleMembersWithProfiles(circleId)).find((m) => m.id === membershipId);
  // Only active students have a control surface (pending = RLS-empty, C1/S1).
  if (!member || member.role !== 'student' || member.status !== 'active') notFound();

  const [logs, sessions, defaultSetId, homework, notes, memorizedRanges] = await Promise.all([
    getLogsForMembership(membershipId),
    getSessions(membershipId),
    getStudentDefaultSetId(membershipId),
    listHomework(membershipId),
    listNotes(membershipId),
    getStudentMemorization(member.user_id),
  ]);

  const account = await getMyChrome(user);
  const memorized = rangesTotals(memorizedRanges);

  return (
    <AppShell breadcrumb={[
      { label: 'Circles', href: '/tracker' },
      { label: circle.name, href: `/tracker/${circleId}` },
      { label: displayName(member) },
    ]} user={account}>
      <main className="px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <div className="max-w-6xl mx-auto w-full" style={{ position: 'relative' }}>
          <BackButton href={`/tracker/${circleId}`} />
          <TeacherStudent
            circle={circle}
            member={member}
            initialSessions={sessions}
            defaultSetId={defaultSetId}
            initialHomework={homework}
            logs={logs}
            memorized={memorized}
            initialNotes={notes}
          />
        </div>
      </main>
    </AppShell>
  );
}
