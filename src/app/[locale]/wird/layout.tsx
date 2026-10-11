import AppShell from '@/components/AppShell';
import { ProfileMenuLive } from '@/components/ProfileMenu';

/**
 * Persistent chrome for /wird. No server reads (PRD 0016 C4): the profile menu
 * fills client-side, so the route prerenders as a complete static shell.
 */
export default function WirdLayout({ children }: { children: React.ReactNode }) {
  return <AppShell profile={<ProfileMenuLive />}>{children}</AppShell>;
}
