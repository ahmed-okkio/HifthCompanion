import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import MarkCircleReady from '@/components/tracker/CircleReady';
import TeacherCircle from '@/components/tracker/TeacherCircle';
import StudentCircle from '@/components/tracker/StudentCircle';
import AcceptInvite from '@/components/tracker/AcceptInvite';
import { getCircle } from '@/lib/services/circle';
import { getCircleMembers, getCircleMembersWithProfiles, getCircleRoster, getStudentDefaultSetId } from '@/lib/services/membership';
import { getStudentMemorization } from '@/lib/services/profile';
import { rangesTotals } from '@/lib/analytics';
import { markedPages as fetchMarkedPages } from '@/lib/services/markedPages';
import { getProfilesByIds } from '@/lib/services/profile';
import { getLogsForMembership } from '@/lib/services/progressLog';
import { getSessions } from '@/lib/services/sessions';
import { listHomework } from '@/lib/services/homework';
import { listNotes } from '@/lib/services/membershipNotes';
import { getExamsForMembership } from '@/lib/services/exam';
import { displayName } from '@/lib/displayName';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { listSubstitutions } from '@/lib/services/substitution';
import CoveringSection from '@/components/tracker/CoveringSection';

export default async function CirclePage({
  params,
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const dict = getDictionary(await getLocale());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const circle = await getCircle(circleId);
  if (!circle) notFound();

  const isTeacher = circle.teacher_id === user.id;

  if (isTeacher) {
    const members = await getCircleMembersWithProfiles(circleId);
    const students = members.filter((m) => m.role === 'student');
    // Sessions are no longer rendered here — the Manage-sessions tab fetches its
    // own week via getManageSlots, so the dashboard load stays roster-only.
    return (
      <main className="px-4 py-6 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <MarkCircleReady />
        <div className="max-w-[96rem] mx-auto w-full" style={{ position: 'relative' }}>
          <CoveringSection />
          <TeacherCircle
            circle={circle}
            teacher={members.find((m) => m.role === 'teacher')}
            initialStudents={students}
          />
        </div>
      </main>
    );
  }

  // Student self-service view (M6, D3/E2-E6/F1-F3/G2-G3).
  const members = await getCircleMembers(circleId);
  const membership = members.find((m) => m.user_id === user.id);
  if (!membership) notFound();

  // Consent gate (C3/C4): a pending student must accept before any data view.
  if (membership.status === 'pending') {
    const profiles = await getProfilesByIds([circle.teacher_id]);
    const tp = profiles.get(circle.teacher_id);
    const teacherName = displayName({
      user_id: circle.teacher_id,
      first_name: tp?.first_name,
      last_name: tp?.last_name,
    });
    return (
      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <MarkCircleReady />
        <AcceptInvite
          membershipId={membership.id}
          circleName={circle.name}
          teacherName={teacherName}
        />
      </main>
    );
  }

  const [initialLogs, initialSessions, initialHomework, initialNotes, roster, initialExams, defaultSetId, memorizedRanges] = await Promise.all([
    getLogsForMembership(membership.id),
    getSessions(membership.id),
    listHomework(membership.id),
    listNotes(membership.id),
    getCircleRoster(circleId),
    getExamsForMembership(membership.id),
    getStudentDefaultSetId(membership.id),
    getStudentMemorization(user.id),
  ]);
  const memorized = rangesTotals(memorizedRanges);
  // C2: student sees their own default-set marked pages (own-set RLS).
  const marked = defaultSetId ? await fetchMarkedPages(supabase, defaultSetId) : [];

  // Covered-by on the student's own sessions (F5/D13): their own substitution
  // rows, keyed by instant. Sub-name is best-effort (profile may be RLS-hidden).
  const mySubs = await listSubstitutions([membership.id]);
  const mySubProfiles = await getProfilesByIds(mySubs.map((s) => s.substitute_user_id));
  const coveredBy: Record<string, string> = {};
  for (const s of mySubs) {
    const p = mySubProfiles.get(s.substitute_user_id);
    coveredBy[String(new Date(s.scheduled_at).getTime())] =
      displayName({ user_id: s.substitute_user_id, first_name: p?.first_name, last_name: p?.last_name });
  }

  return (
    <main className="px-4 py-6 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
      <MarkCircleReady />
      <div className="max-w-[96rem] mx-auto w-full" style={{ position: 'relative' }}>
        <CoveringSection />
        <StudentCircle
            circle={circle}
            membership={membership}
            initialSessions={initialSessions}
            initialLogs={initialLogs}
            initialHomework={initialHomework}
            initialNotes={initialNotes}
            initialExams={initialExams}
            roster={roster}
            selfUserId={user.id}
            memorized={memorized}
            defaultSetId={defaultSetId}
            markedPages={marked}
            coveredBy={coveredBy}
        />
      </div>
    </main>
  );
}
