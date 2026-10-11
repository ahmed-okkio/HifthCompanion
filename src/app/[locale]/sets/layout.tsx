import AppShell from '@/components/AppShell';
import { ProfileMenuLive } from '@/components/ProfileMenu';

/** Persistent chrome for /sets. No server reads (PRD 0016 C4): the menu fills client-side. */
export default function SetsLayout({ children }: { children: React.ReactNode }) {
  return <AppShell profile={<ProfileMenuLive />}>{children}</AppShell>;
}
