'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query/keys';
import { loadSettings } from '@/lib/settings/reads';
import QueryFallback from '@/components/QueryFallback';
import { Sk } from '@/components/Skeleton';
import ProfileClient from '@/components/ProfileClient';
import EmailPrefsSection from '@/components/EmailPrefsSection';
import PushToggle from '@/components/PushToggle';
import WirdReminderRow from '@/components/WirdReminderRow';
import SettingsHeader, { SettingsSection } from '@/components/SettingsHeader';

// Settings (PRD 0008 M4, PRD 0010 M4). Static shell (PRD 0016 C2): data is read client-side;
// auth is the proxy's / ShellAuthGuard's (/settings is protected). Children seed local state
// from props, so each is keyed on its value: a refetch that changes it remounts with the truth.
export default function SettingsPage() {
  const q = useQuery({ queryKey: qk.settings, queryFn: () => loadSettings(createClient()) });
  const d = q.data;

  return (
    <main className="max-w-2xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full overflow-y-auto h-full">
      <div className="flex flex-col gap-8">
        <SettingsHeader />
        {!d ? (
          <QueryFallback q={q} skeleton={<div className="flex flex-col gap-8">{[0, 1].map((i) => <Sk key={i} h={220} r={16} />)}</div>} />
        ) : (
          <>
            <SettingsSection labelKey="settings.sectionHifth">
              <ProfileClient key={JSON.stringify([d.ranges, d.weakest])} initialRanges={d.ranges} initialWeakest={d.weakest} />
            </SettingsSection>
            <SettingsSection labelKey="settings.sectionNotifications">
              <EmailPrefsSection key={JSON.stringify(d.emailPrefs)} initial={d.emailPrefs} />
              <PushToggle />
              <WirdReminderRow key={`${d.reminder}-${d.hasWirds}`} initial={d.reminder} hasWirds={d.hasWirds} />
            </SettingsSection>
          </>
        )}
      </div>
    </main>
  );
}
