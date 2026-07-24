import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import MarkCircleReady from '@/components/tracker/CircleReady';
import CoveringSection from '@/components/tracker/CoveringSection';
import { EmptyState } from '@/components/tracker/ui';
import { getCovering } from '@/lib/services/substitution';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { getLocale } from '@/lib/i18n/server';

/**
 * 0013 G1 — the substitute's own temporary "circle". A literal segment, so it
 * wins over /tracker/[circleId] and needs no guard: covering_sessions() only
 * ever returns the caller's own live coverage, and the rail only offers this
 * entry while there is some. Coverage self-expires, hence no circle row.
 */
export default async function CoveringPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const rows = await getCovering();
  const dict = getDictionary(await getLocale());

  return (
    <main className="max-w-5xl mx-auto px-4 py-6 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
      <MarkCircleReady />
      {/* Empty only once the last covered instant expired out of the RPC — the
          rail entry is gone by the next load. */}
      {rows.length === 0 ? <EmptyState>{dict['subs.coveringEmpty']}</EmptyState> : <CoveringSection />}
    </main>
  );
}
