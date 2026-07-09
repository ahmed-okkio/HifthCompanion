import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import ProfileMenuAsync, { ProfileMenuFallback } from '@/components/ProfileMenuAsync';

/**
 * Persistent chrome for /sets. Deliberately SYNC (no awaits) so it returns
 * immediately — the profile menu streams via Suspense and the page's loading.tsx
 * shows instantly. An awaited layout would block that skeleton. Auth is enforced
 * in the page (inside the loading boundary).
 */
export default function SetsLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell profile={<Suspense fallback={<ProfileMenuFallback />}><ProfileMenuAsync /></Suspense>}>
      {children}
    </AppShell>
  );
}
