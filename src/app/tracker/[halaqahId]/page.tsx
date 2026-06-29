import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { getMyChrome } from '@/lib/services/profile';
import TeacherHalaqahTabs from '@/components/tracker/TeacherHalaqahTabs';
import StudentHalaqah from '@/components/tracker/StudentHalaqah';
import { getHalaqah } from '@/lib/services/halaqah';
import { getHalaqahMembers, getHalaqahMembersWithProfiles } from '@/lib/services/membership';
import { getLogsForMembership, getLogsForMemberships } from '@/lib/services/progressLog';
import { getSessions } from '@/lib/services/sessions';
import { getAttendanceForSessions } from '@/lib/services/attendance';
import { getAnnotationSets } from '@/lib/services/annotationSets';

export default async function HalaqahPage({
  params,
}: {
  params: Promise<{ halaqahId: string }>;
}) {
  const { halaqahId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const halaqah = await getHalaqah(halaqahId);
  if (!halaqah) notFound();

  const isTeacher = halaqah.teacher_id === user.id;
  // Teachers see named rosters; a student only needs their own membership row.
  const members = isTeacher
    ? await getHalaqahMembersWithProfiles(halaqahId)
    : await getHalaqahMembers(halaqahId);
  const activeStudents = members.filter((m) => m.role === 'student' && m.status === 'active');

  let sessions: Awaited<ReturnType<typeof getSessions>> = [];
  let attendance: Awaited<ReturnType<typeof getAttendanceForSessions>> = [];
  if (isTeacher) {
    sessions = await getSessions(halaqahId);
    attendance = await getAttendanceForSessions(sessions.map((s) => s.id));
  }

  const account = await getMyChrome(user);

  return (
    <AppShell breadcrumb={halaqah.name} user={account}>
      <main className={`mx-auto px-4 py-6 sm:py-6 animate-fade-in flex flex-col flex-1 min-h-0 ${isTeacher ? 'max-w-5xl w-full' : 'max-w-2xl'}`} style={{ overflow: isTeacher ? 'hidden' : 'auto' }}>
        {isTeacher ? (
          <TeacherHalaqahTabs
            halaqah={halaqah}
            teacher={members.find((m) => m.role === 'teacher')}
            members={members.filter((m) => m.role === 'student')}
            initialFeed={await getLogsForMemberships(
              members.filter((m) => m.role === 'student').map((m) => m.id),
            )}
            students={activeStudents}
            sessions={sessions}
            attendance={attendance}
          />
        ) : (
          <StudentHalaqah
            halaqah={halaqah}
            membership={members.find((m) => m.user_id === user.id)!}
            initialLogs={await getLogsForMembership(
              members.find((m) => m.user_id === user.id)?.id ?? '',
            )}
            sets={await getAnnotationSets()}
          />
        )}
      </main>
    </AppShell>
  );
}
