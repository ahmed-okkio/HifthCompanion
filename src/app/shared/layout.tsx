import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import ProfileMenuAsync, { ProfileMenuFallback } from '@/components/ProfileMenuAsync';

/**
 * Persistent chrome for /shared — see sets/layout.tsx. Sync so the page's loading.tsx
 * shows instantly; the profile menu streams. Auth is enforced in the page.
 */
export default function SharedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell profile={<Suspense fallback={<ProfileMenuFallback />}><ProfileMenuAsync /></Suspense>}>
      {children}
    </AppShell>
  );
}
