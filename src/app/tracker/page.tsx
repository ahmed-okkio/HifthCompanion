import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import TrackerHome from '@/components/tracker/TrackerHome';
import { getMyMembershipsWithHalaqah } from '@/lib/services/membership';

export default async function TrackerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const memberships = await getMyMembershipsWithHalaqah();

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
      <header className="sticky top-0 z-50 border-b"
              style={{ background: 'var(--surface-main)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-e1)' }}>
        <div className="mx-auto flex items-center justify-between px-4 py-3 max-w-2xl">
          <Link href="/reader/1" className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ color: 'var(--text-accent)' }}>حفظ</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>HifthCompanion</span>
          </Link>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
        <TrackerHome initialMemberships={memberships} />
      </main>
    </div>
  );
}
