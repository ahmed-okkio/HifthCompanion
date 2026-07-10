import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import ProfileMenu from '@/components/ProfileMenu';
import CircleRail from '@/components/tracker/CircleRail';
import { railCircles } from '@/lib/tracker/railCircles';
import { getMyChrome } from '@/lib/services/profile';
import { getMyMembershipsWithCircle } from '@/lib/services/membership';
import { CircleReadyProvider } from '@/components/tracker/CircleReady';

/**
 * Persistent chrome for the tracker (index, circles, student sub-pages). Placed ABOVE
 * the [circleId] param (route group) so it renders ONCE on entry and stays mounted
 * across circle→circle nav — the header/ProfileMenu never remount and the circle rail
 * persists.
 *
 * The rail + profile are AWAITED here (not streamed): because this layout has no param
 * it isn't re-run on circle switches, so its (fast) fetches only cost on first entry.
 * Awaiting them means that on first open the rail appears TOGETHER with the circle's
 * content skeleton — not popping in by itself before the (slower) content. The circle
 * content's own loading.tsx still shows while the page's heavy fetches run. Between
 * circles the layout is untouched, so only the content skeleton shows (rail stays put).
 */
export default async function TrackerShellLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const [account, memberships] = await Promise.all([
    getMyChrome(user),
    getMyMembershipsWithCircle(),
  ]);

  return (
    <CircleReadyProvider>
      <AppShell
        profile={<ProfileMenu name={account.name} email={account.email} />}
        secondRail={<CircleRail circles={railCircles(memberships)} />}
      >
        {children}
      </AppShell>
    </CircleReadyProvider>
  );
}
