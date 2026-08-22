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
import { getSessions, getSessionsForMemberships } from '@/lib/services/sessions';
import { floatingNow, sectionSessions } from '@/lib/recurrence';
import { listHomework } from '@/lib/services/homework';
import { listNotes } from '@/lib/services/membershipNotes';
import { getExamsForMembership } from '@/lib/services/exam';
import { displayName } from '@/lib/displayName';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { listSubstitutions } from '@/lib/services/substitution';

export default async function CirclePage({
  params,
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const dict = getDictionary(await getLocale());
  const supabase = await createClient();
  // One wave, not three: a server action re-renders this page before its
  // response reaches the client, so every sequential await is button latency.
  // RLS returns nothing to a signed-out request, so these are safe together.
  const [{ data: { user } }, circle, teacherMembers] = await Promise.all([
    supabase.auth.getUser(),
    getCircle(circleId),
    getCircleMembersWithProfiles(circleId),
  ]);
  if (!user) redirect('/login');
  if (!circle) notFound();

  const isTeacher = circle.teacher_id === user.id;

  if (isTeacher) {
    const members = teacherMembers;
    const students = members.filter((m) => m.role === 'student');
    // Sessions are no longer rendered here — the Manage-sessions tab fetches its
    // own week via getManageSlots, so the dashboard load stays roster-only.
    // 0014 G1/G3: one query for the whole roster, next slot derived in memory
    // (same shape as getManageSlots). No per-student query.
    const activeStudents = students.filter((m) => m.status === 'active');
    const rosterSessions = await getSessionsForMemberships(activeStudents.map((m) => m.id));
    const nowDate = floatingNow();
    const nextSlots: Record<string, { scheduled_at: string; canceled: boolean }> = {};
    for (const m of activeStudents) {
      const { next } = sectionSessions(
        m.schedule,
        rosterSessions.filter((s) => s.membership_id === m.id),
        nowDate,
      );
      // G4: no schedule and no rows → no entry, the row renders as it does today.
      if (next) nextSlots[m.id] = { scheduled_at: next.scheduled_at, canceled: next.session?.canceled ?? false };
    }
    return (
      <main className="px-4 py-6 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <MarkCircleReady />
        <div className="max-w-[96rem] mx-auto w-full" style={{ position: 'relative' }}>
          <TeacherCircle
            circle={circle}
            teacher={members.find((m) => m.role === 'teacher')}
            initialStudents={students}
            nextSlots={nextSlots}
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
  // Covered-by on the student's own sessions (F5/D13): their own substitution
  // rows, keyed by instant. Sub-name is best-effort (profile may be RLS-hidden).
  const [marked, mySubs] = await Promise.all([
    defaultSetId ? fetchMarkedPages(supabase, defaultSetId) : [],
    listSubstitutions([membership.id]),
  ]);
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
