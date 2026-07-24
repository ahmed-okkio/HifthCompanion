import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { EmptyState } from '@/components/tracker/ui';
import MarkCircleReady from '@/components/tracker/CircleReady';
import { getMyMembershipsWithCircle } from '@/lib/services/membership';
import { getCovering } from '@/lib/services/substitution';
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

  // A pure substitute has no circle of their own — send them to their coverage
  // rather than an empty state that hides the only thing they can act on.
  if ((await getCovering()).length > 0) redirect('/tracker/covering');

  // No circles yet: show the empty state with only the rail's "+" to create one.
  const dict = getDictionary(await getLocale());

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
      <MarkCircleReady />
      <EmptyState>
        <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{dict['tracker.emptyTitle']}</span>
        <span>{dict['tracker.emptyHint']}</span>
      </EmptyState>
    </main>
  );
}
