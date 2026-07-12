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
import { getSessionsForMemberships, getSessions } from '@/lib/services/sessions';
import { sectionSessions, floatingNow } from '@/lib/recurrence';
import { listHomework } from '@/lib/services/homework';
import { listNotes } from '@/lib/services/membershipNotes';
import { getExamsForMembership } from '@/lib/services/exam';
import { displayName } from '@/lib/displayName';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';

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
    const active = students.filter((m) => m.status === 'active');
    const nameById = new Map(active.map((m) => [m.id, displayName(m)]));

    // Aggregate agenda (D2/D5): each active student's upcoming slots, derived from
    // their schedule rule + real rows — so recurring virtual sessions show too.
    const nowDate = floatingNow();
    const now = nowDate.getTime();
    const sessions = await getSessionsForMemberships(active.map((m) => m.id));
    const agenda = active
      .flatMap((m) => {
        const rows = sessions.filter((s) => s.membership_id === m.id);
        // Teacher agenda shows only each student's single next session (D5).
        const { next } = sectionSessions(m.schedule, rows, nowDate);
        return [next]
          .filter((slot): slot is NonNullable<typeof slot> => !!slot)
          .filter((slot) => new Date(slot.scheduled_at).getTime() >= now)
          .map((slot) => ({
            key: slot.session?.id ?? `${m.id}-${slot.scheduled_at}`,
            membershipId: m.id,
            sessionId: slot.session?.id ?? null,
            scheduled_at: slot.scheduled_at,
            isAdhoc: slot.session?.is_adhoc ?? false,
            canceled: slot.session?.canceled ?? false,
            movedFrom: slot.session?.moved_from ?? null,
            student: nameById.get(m.id) ?? '',
          }));
      })
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .slice(0, 20);

    return (
      <main className="px-4 py-6 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <MarkCircleReady />
        <div className="max-w-[96rem] mx-auto w-full" style={{ position: 'relative' }}>
          <TeacherCircle
            circle={circle}
            teacher={members.find((m) => m.role === 'teacher')}
            initialStudents={students}
            agenda={agenda}
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
        />
      </div>
    </main>
  );
}
