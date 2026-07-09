import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import ProfileMenu from '@/components/ProfileMenu';
import ProfileClient from '@/components/ProfileClient';
import { getMyChrome, getMyMemorization } from '@/lib/services/profile';

// My hifth (PRD 0008 M4, U2). Server component: loads saved ranges to prefill
// the editor. Save persists edits and re-stamps onboarded_at (stays non-null),
// so editing here never re-triggers onboarding.
export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ ranges, weakest }, account] = await Promise.all([
    getMyMemorization(),
    getMyChrome(user),
  ]);

  return (
    <AppShell profile={<ProfileMenu name={account.name} email={account.email} />}>
      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full"
            style={{ overflowY: 'auto', height: '100%' }}>
        <ProfileClient initialRanges={ranges} initialWeakest={weakest} />
      </main>
    </AppShell>
  );
}
