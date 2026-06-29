import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import TrackerHome from '@/components/tracker/TrackerHome';
import { getMyMembershipsWithHalaqah } from '@/lib/services/membership';
import { getMyChrome } from '@/lib/services/profile';

export default async function TrackerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const memberships = await getMyMembershipsWithHalaqah();
  const account = await getMyChrome(user);

  return (
    <AppShell user={account}>
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <TrackerHome initialMemberships={memberships} />
      </main>
    </AppShell>
  );
}
