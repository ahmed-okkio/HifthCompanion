import AppShell from '@/components/AppShell';
import { ProfileMenuLive } from '@/components/ProfileMenu';

/** Persistent chrome for /shared. No server reads (PRD 0016 B3/C4): the menu fills client-side. */
export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return <AppShell profile={<ProfileMenuLive />}>{children}</AppShell>;
}
