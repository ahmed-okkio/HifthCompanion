import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import ProfileMenuAsync, { ProfileMenuFallback } from '@/components/ProfileMenuAsync';
import CircleRailData, { CircleRailFallback } from '@/components/tracker/CircleRailData';

/**
 * Persistent chrome for the tracker (index, circles, student sub-pages). Placed ABOVE
 * the [circleId] param (route group) so it stays mounted across circle→circle nav, and
 * kept SYNC (no awaits) so the child loading.tsx shows INSTANTLY: the profile menu and
 * circle rail both stream via Suspense instead of blocking the render. The rail derives
 * the active circle client-side from the pathname; auth is enforced in the pages.
 * (join/* stays outside this group → no chrome.)
 */
export default function TrackerShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell
      profile={<Suspense fallback={<ProfileMenuFallback />}><ProfileMenuAsync /></Suspense>}
      secondRail={<Suspense fallback={<CircleRailFallback />}><CircleRailData /></Suspense>}
    >
      {children}
    </AppShell>
  );
}
