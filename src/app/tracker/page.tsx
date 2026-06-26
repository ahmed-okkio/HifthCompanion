import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import AppHeader from '@/components/AppHeader';
import TrackerHome from '@/components/tracker/TrackerHome';
import { getMyMembershipsWithHalaqah } from '@/lib/services/membership';

export default async function TrackerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const memberships = await getMyMembershipsWithHalaqah();

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
      <AppHeader right={<LanguageSwitcher />} />

      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10 animate-fade-in">
        <TrackerHome initialMemberships={memberships} />
      </main>
    </div>
  );
}
