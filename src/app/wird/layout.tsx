import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import ProfileMenuAsync, { ProfileMenuFallback } from '@/components/ProfileMenuAsync';

/**
 * Persistent chrome for /wird. SYNC (no awaits) so it returns immediately —
 * the profile menu streams via Suspense and the page's loading.tsx shows
 * instantly. Auth is enforced in the page (inside the loading boundary).
 * Mirrors src/app/sets/layout.tsx.
 */
export default function WirdLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell profile={<Suspense fallback={<ProfileMenuFallback />}><ProfileMenuAsync /></Suspense>}>
      {children}
    </AppShell>
  );
}
