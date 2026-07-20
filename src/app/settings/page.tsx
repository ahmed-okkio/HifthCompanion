import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import ProfileMenu from '@/components/ProfileMenu';
import ProfileClient from '@/components/ProfileClient';
import EmailPrefsSection from '@/components/EmailPrefsSection';
import SettingsHeader, { SettingsSection } from '@/components/SettingsHeader';
import { getMyChrome, getMyMemorization, getMyProfile } from '@/lib/services/profile';

// Settings (PRD 0008 M4, U2; PRD 0010 M4). Two sections: My Hifth (the
// memorization editor, prefilled from saved ranges — saving re-stamps
// onboarded_at so editing never re-triggers onboarding) and Notifications.
export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [{ ranges, weakest }, account, profile] = await Promise.all([
    getMyMemorization(),
    getMyChrome(user),
    getMyProfile(),
  ]);

  return (
    <AppShell profile={<ProfileMenu name={account.name} email={account.email} />}>
      <main className="max-w-2xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full"
            style={{ overflowY: 'auto', height: '100%' }}>
        <div className="flex flex-col" style={{ gap: 'var(--space-32)' }}>
          <SettingsHeader />

          <SettingsSection labelKey="settings.sectionHifth">
            <ProfileClient initialRanges={ranges} initialWeakest={weakest} />
          </SettingsSection>

          <SettingsSection labelKey="settings.sectionNotifications">
            <EmailPrefsSection initial={profile?.email_prefs ?? {}} />
          </SettingsSection>
        </div>
      </main>
    </AppShell>
  );
}
