import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getMyChrome } from '@/lib/services/profile';
import TeacherCircle from '@/components/tracker/TeacherCircle';
import StudentCircle from '@/components/tracker/StudentCircle';
import AcceptInvite from '@/components/tracker/AcceptInvite';
import { getCircle } from '@/lib/services/circle';
import { getCircleMembers, getCircleMembersWithProfiles, getCircleRoster, getStudentDefaultSetId } from '@/lib/services/membership';
import { getStudentMemorization } from '@/lib/services/profile';
import { rangesTotals } from '@/lib/analytics';
import { getProfilesByIds } from '@/lib/services/profile';
import { getLogsForMembership } from '@/lib/services/progressLog';
import { getSessionsForMemberships, getSessions } from '@/lib/services/sessions';
import { sectionSessions, floatingNow } from '@/lib/recurrence';
import { listHomework } from '@/lib/services/homework';
import { listNotes } from '@/lib/services/membershipNotes';
import { getExamsForMembership } from '@/lib/services/exam';
import { displayName } from '@/lib/displayName';
import { BackButton } from '@/components/tracker/ui';

export default async function CirclePage({
  params,
}: {
  params: Promise<{ circleId: string }>;
}) {
  const { circleId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const circle = await getCircle(circleId);
  if (!circle) notFound();

  const isTeacher = circle.teacher_id === user.id;
  const account = await getMyChrome(user);

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
        const { next, upcoming } = sectionSessions(m.schedule, rows, nowDate);
        return [next, ...upcoming]
          .filter((slot): slot is NonNullable<typeof slot> => !!slot)
          .filter((slot) => new Date(slot.scheduled_at).getTime() >= now)
          .map((slot) => ({
            key: slot.session?.id ?? `${m.id}-${slot.scheduled_at}`,
            scheduled_at: slot.scheduled_at,
            isAdhoc: slot.session?.is_adhoc ?? false,
            student: nameById.get(m.id) ?? '',
          }));
      })
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .slice(0, 20);

    return (
      <AppShell breadcrumb={[{ label: 'Circles', href: '/tracker' }, { label: circle.name }]} user={account}>
        <main className="px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
          <div className="max-w-5xl mx-auto w-full" style={{ position: 'relative' }}>
            <BackButton href="/tracker" />
            <TeacherCircle
              circle={circle}
              teacher={members.find((m) => m.role === 'teacher')}
              initialStudents={students}
              agenda={agenda}
            />
          </div>
        </main>
      </AppShell>
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
      <AppShell breadcrumb={[{ label: 'Circles', href: '/tracker' }, { label: circle.name }]} user={account}>
        <main className="max-w-2xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
          <AcceptInvite
            membershipId={membership.id}
            circleName={circle.name}
            teacherName={teacherName}
          />
        </main>
      </AppShell>
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

  return (
    <AppShell breadcrumb={[{ label: 'Circles', href: '/tracker' }, { label: circle.name }]} user={account}>
      <main className="px-4 py-6 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <div className="max-w-[96rem] mx-auto w-full" style={{ position: 'relative' }}>
          <BackButton href="/tracker" />
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
          />
        </div>
      </main>
    </AppShell>
  );
}
