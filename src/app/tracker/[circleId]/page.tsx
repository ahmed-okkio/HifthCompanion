import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getMyChrome } from '@/lib/services/profile';
import TeacherCircle from '@/components/tracker/TeacherCircle';
import StudentCircle from '@/components/tracker/StudentCircle';
import AcceptInvite from '@/components/tracker/AcceptInvite';
import { getCircle } from '@/lib/services/circle';
import { getCircleMembers, getCircleMembersWithProfiles } from '@/lib/services/membership';
import { getProfilesByIds } from '@/lib/services/profile';
import { getLogsForMembership } from '@/lib/services/progressLog';
import { getSessionsForMemberships, getSessions } from '@/lib/services/sessions';
import { listHomework } from '@/lib/services/homework';
import { listNotes } from '@/lib/services/membershipNotes';
import { displayName } from '@/lib/displayName';

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

    // Aggregate agenda (D2/D5): all active students' upcoming, non-canceled sessions.
    const now = Date.now();
    const sessions = await getSessionsForMemberships(active.map((m) => m.id));
    const agenda = sessions
      .filter((s) => !s.canceled && new Date(s.scheduled_at).getTime() >= now)
      .slice(0, 20)
      .map((s) => ({ session: s, student: nameById.get(s.membership_id) ?? '' }));

    return (
      <AppShell breadcrumb={circle.name} user={account}>
        <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
          <TeacherCircle
            circle={circle}
            teacher={members.find((m) => m.role === 'teacher')}
            initialStudents={students}
            agenda={agenda}
          />
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
      <AppShell breadcrumb={circle.name} user={account}>
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

  const [initialLogs, initialSessions, initialHomework, initialNotes] = await Promise.all([
    getLogsForMembership(membership.id),
    getSessions(membership.id),
    listHomework(membership.id),
    listNotes(membership.id),
  ]);

  return (
    <AppShell breadcrumb={circle.name} user={account}>
      <main className="max-w-5xl mx-auto px-4 py-6 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <StudentCircle
          circle={circle}
          membership={membership}
          initialSessions={initialSessions}
          initialLogs={initialLogs}
          initialHomework={initialHomework}
          initialNotes={initialNotes}
        />
      </main>
    </AppShell>
  );
}
