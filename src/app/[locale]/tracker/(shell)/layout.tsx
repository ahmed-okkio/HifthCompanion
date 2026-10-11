import AppShell from '@/components/AppShell';
import { ProfileMenuLive } from '@/components/ProfileMenu';
import { CircleRailLive } from '@/components/tracker/CircleRail';
import { CircleReadyProvider } from '@/components/tracker/CircleReady';
import { ActionFeedbackProvider } from '@/components/tracker/ui';

/**
 * Persistent chrome for the tracker (index, circles, student pages, covering). Above the
 * pages (route group), so it stays mounted across circle switches. No server reads
 * (PRD 0016 B3/C4): the profile menu and circle rail fill client-side; auth is the proxy's.
 */
export default function TrackerShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <CircleReadyProvider>
      <ActionFeedbackProvider>
        <AppShell profile={<ProfileMenuLive />} secondRail={<CircleRailLive />}>
          {children}
        </AppShell>
      </ActionFeedbackProvider>
    </CircleReadyProvider>
  );
}
