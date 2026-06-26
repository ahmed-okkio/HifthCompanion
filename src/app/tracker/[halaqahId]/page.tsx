import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AppHeader from '@/components/AppHeader';
import TeacherHalaqah from '@/components/tracker/TeacherHalaqah';
import TeacherSessions from '@/components/tracker/TeacherSessions';
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

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
      <AppHeader breadcrumb={halaqah.name} right={<LanguageSwitcher />} />

      <main className={`mx-auto px-4 py-8 sm:py-10 animate-fade-in ${isTeacher ? 'max-w-5xl' : 'max-w-2xl'}`}>
        {isTeacher ? (
          <div className="grid gap-8 lg:grid-cols-2 items-start">
            <TeacherHalaqah
              halaqah={halaqah}
              initialMembers={members.filter((m) => m.role === 'student')}
              initialFeed={await getLogsForMemberships(
                members.filter((m) => m.role === 'student').map((m) => m.id),
              )}
            />
            <TeacherSessions
              halaqah={halaqah}
              students={activeStudents}
              initialSessions={sessions}
              initialAttendance={attendance}
            />
          </div>
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
    </div>
  );
}
