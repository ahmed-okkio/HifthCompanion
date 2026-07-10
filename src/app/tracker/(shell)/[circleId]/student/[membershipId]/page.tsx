import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import { getCircle } from '@/lib/services/circle';
import { getCircleMembersWithProfiles, getStudentDefaultSetId } from '@/lib/services/membership';
import { getLogsForMembership } from '@/lib/services/progressLog';
import { getSessions } from '@/lib/services/sessions';
import { listHomework } from '@/lib/services/homework';
import { listNotes } from '@/lib/services/membershipNotes';
import { getExamsForMembership } from '@/lib/services/exam';
import { getStudentMemorization } from '@/lib/services/profile';
import { rangesTotals } from '@/lib/analytics';
import { markedPages as fetchMarkedPages } from '@/lib/services/markedPages';
import TeacherStudent from '@/components/tracker/TeacherStudent';
import MarkCircleReady from '@/components/tracker/CircleReady';
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

  const memorized = rangesTotals(memorizedRanges);
  // C1: default-set marked pages. RLS: teacher reads via the set_collaborators grant
  // created at membership-accept. No default set → empty list (C3 empty state).
  const marked = defaultSetId ? await fetchMarkedPages(supabase, defaultSetId) : [];

  return (
    <main className="px-4 py-6 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
      <MarkCircleReady />
      <div className="max-w-[96rem] mx-auto w-full" style={{ position: 'relative' }}>
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
  );
}
