import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import TeacherHalaqah from '@/components/tracker/TeacherHalaqah';
import StudentHalaqah from '@/components/tracker/StudentHalaqah';
import { getHalaqah } from '@/lib/services/halaqah';
import { getHalaqahMembers } from '@/lib/services/membership';
import { getLogsForMembership, getLogsForMemberships } from '@/lib/services/progressLog';
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
  const members = await getHalaqahMembers(halaqahId);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
      <header className="sticky top-0 z-50 border-b"
              style={{ background: 'var(--surface-main)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-e1)' }}>
        <div className="mx-auto flex items-center justify-between px-4 py-3 max-w-2xl">
          <Link href="/tracker" className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ color: 'var(--text-accent)' }}>←</span>
            <span className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{halaqah.name}</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
        {isTeacher ? (
          <TeacherHalaqah
            halaqah={halaqah}
            initialMembers={members.filter((m) => m.role === 'student')}
            initialFeed={await getLogsForMemberships(
              members.filter((m) => m.role === 'student').map((m) => m.id),
            )}
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
    </div>
  );
}
