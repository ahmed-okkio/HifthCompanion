import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import ProfileMenu from '@/components/ProfileMenu';
import CircleRail from '@/components/tracker/CircleRail';
import { railCircles, COVERING_RAIL_ID } from '@/lib/tracker/railCircles';
import { getCovering } from '@/lib/services/substitution';
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

  const [account, memberships, covering] = await Promise.all([
    getMyChrome(user),
    getMyMembershipsWithCircle(),
    getCovering(),
  ]);

  // 0013 G1: active coverage rides the rail as its own temporary circle rather
  // than repeating on every real circle page. It disappears on its own once the
  // last covered instant expires — the RPC only returns live rows.
  const circles = railCircles(memberships);
  if (covering.length > 0) {
    circles.push({ id: COVERING_RAIL_ID, name: '', pending: false, teaching: false, covering: true });
  }

  return (
    <CircleReadyProvider>
      <AppShell
        profile={<ProfileMenu name={account.name} email={account.email} />}
        secondRail={<CircleRail circles={circles} />}
      >
        {children}
      </AppShell>
    </CircleReadyProvider>
  );
}
