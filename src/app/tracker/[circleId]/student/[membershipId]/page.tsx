import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import AppShell from '@/components/AppShell';
import CircleRail from '@/components/tracker/CircleRail';
import { railCircles } from '@/lib/tracker/railCircles';
import { getCircle } from '@/lib/services/circle';
import { getCircleMembersWithProfiles, getStudentDefaultSetId, getMyMembershipsWithCircle } from '@/lib/services/membership';
import { getLogsForMembership } from '@/lib/services/progressLog';
import { getSessions } from '@/lib/services/sessions';
import { listHomework } from '@/lib/services/homework';
import { listNotes } from '@/lib/services/membershipNotes';
import { getExamsForMembership } from '@/lib/services/exam';
import { getMyChrome, getStudentMemorization } from '@/lib/services/profile';
import { rangesTotals } from '@/lib/analytics';
import { markedPages as fetchMarkedPages } from '@/lib/services/markedPages';
import TeacherStudent from '@/components/tracker/TeacherStudent';
import { BackButton } from '@/components/tracker/ui';
import { displayName } from '@/lib/displayName';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ circleId: string; membershipId: string }>;
}) {
  const { circleId, membershipId } = await params;
  const dict = getDictionary(await getLocale());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const circle = await getCircle(circleId);
  if (!circle || circle.teacher_id !== user.id) notFound();

  const member = (await getCircleMembersWithProfiles(circleId)).find((m) => m.id === membershipId);
  // Only active students have a control surface (pending = RLS-empty, C1/S1).
  if (!member || member.role !== 'student' || member.status !== 'active') notFound();

  const [logs, sessions, defaultSetId, homework, notes, memorizedRanges, exams] = await Promise.all([
    getLogsForMembership(membershipId),
    getSessions(membershipId),
    getStudentDefaultSetId(membershipId),
    listHomework(membershipId),
    listNotes(membershipId),
    getStudentMemorization(member.user_id),
    getExamsForMembership(membershipId),
  ]);

  const account = await getMyChrome(user);
  const memorized = rangesTotals(memorizedRanges);
  // C1: default-set marked pages. RLS: teacher reads via the set_collaborators grant
  // created at membership-accept. No default set → empty list (C3 empty state).
  const marked = defaultSetId ? await fetchMarkedPages(supabase, defaultSetId) : [];

  return (
    <AppShell breadcrumb={[
      { label: dict['nav.circles'], href: '/tracker' },
      { label: circle.name, href: `/tracker/${circleId}` },
      { label: displayName(member) },
    ]} user={account} secondRail={<CircleRail circles={railCircles(await getMyMembershipsWithCircle())} currentId={circleId} />}>
      <main className="px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <div className="max-w-[96rem] mx-auto w-full" style={{ position: 'relative' }}>
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
            initialExams={exams}
            markedPages={marked}
          />
        </div>
      </main>
    </AppShell>
  );
}
