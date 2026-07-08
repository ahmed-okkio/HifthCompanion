import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import CircleRail from '@/components/tracker/CircleRail';
import { railCircles } from '@/lib/tracker/railCircles';
import { EmptyState } from '@/components/tracker/ui';
import { getMyMembershipsWithCircle } from '@/lib/services/membership';
import { getMyChrome } from '@/lib/services/profile';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getLocale } from '@/lib/i18n/server';

export default async function TrackerPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const memberships = await getMyMembershipsWithCircle();

  // Open the first circle by default (active preferred, else a pending invite).
  const first = memberships.find((m) => m.status === 'active') ?? memberships.find((m) => m.status === 'pending');
  if (first) redirect(`/tracker/${first.circle_id}`);

  // No circles yet: show the empty state with only the rail's "+" to create one.
  const account = await getMyChrome(user);
  const dict = getDictionary(await getLocale());

  return (
    <AppShell user={account} secondRail={<CircleRail circles={railCircles(memberships)} />}>
      <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <EmptyState>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{dict['tracker.emptyTitle']}</span>
          <span>{dict['tracker.emptyHint']}</span>
        </EmptyState>
      </main>
    </AppShell>
  );
}
