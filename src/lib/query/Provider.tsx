'use client';
import { useEffect, useRef, useState } from 'react';
import { IsRestoringProvider, QueryClientProvider } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { makeQueryClient } from './client';
import { clearQueryCache, restoreFor } from './persist';

const qc = makeQueryClient();
export const queryClient = qc;

// Binds the persisted cache to the session user (PRD 0016 dec. 7/8): nothing is
// restored without a user id; a different user wipes memory + IDB first.
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [restoring, setRestoring] = useState(true);
  const current = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const sb = createClient();
    let alive = true;
    // Identity change: drop memory synchronously, before any render of the next user.
    const bind = (id: string | null) => {
      if (!alive || id === current.current) return;
      current.current = id;
      qc.clear();
      setRestoring(true);
      setUserId(id);
    };
    sb.auth.getSession().then(({ data }) => bind(data.session?.user.id ?? null));
    // Mock client (e2e) has no onAuthStateChange.
    const sub = sb.auth.onAuthStateChange?.((_e, s) => bind(s?.user.id ?? null));
    return () => { alive = false; sub?.data.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (userId === undefined) return;
    let unsub: (() => void) | undefined;
    let alive = true;
    (async () => {
      if (userId === null) await clearQueryCache(qc);
      else {
        const u = await restoreFor(qc, userId);
        if (alive) unsub = u; else u();
      }
      if (alive) setRestoring(false);
    })();
    return () => { alive = false; unsub?.(); };
  }, [userId]);

  return (
    <QueryClientProvider client={qc}>
      <IsRestoringProvider value={restoring}>{children}</IsRestoringProvider>
    </QueryClientProvider>
  );
}
