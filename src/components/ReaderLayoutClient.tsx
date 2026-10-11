'use client';
import { useQuery } from '@tanstack/react-query';
import ReaderShell, { ReaderShellSkeleton } from '@/components/ReaderShell';
import { fetchMe } from '@/components/ProfileMenu';
import { fetchSets } from '@/components/SetsScreen';
import QueryFallback from '@/components/QueryFallback';
import { qk } from '@/lib/query/keys';

/** Reader chrome data via TanStack Query (PRD 0016 E1); same keys as /sets and the profile menu. */
export function useReaderData() {
  const me = useQuery({ queryKey: qk.me, queryFn: fetchMe });
  const sets = useQuery({ queryKey: qk.sets, queryFn: fetchSets });
  return { me, sets, ready: me.data !== undefined && sets.data !== undefined };
}

export default function ReaderLayoutClient({ children }: { children: React.ReactNode }) {
  const { me, sets, ready } = useReaderData();
  if (!ready) {
    return (
      <>
        <QueryFallback q={me.data === undefined ? me : sets} skeleton={<ReaderShellSkeleton />} />
        {/* Kept mounted (hidden) so the /reader index redirect still fires. */}
        <div className="absolute size-0 overflow-hidden pointer-events-none" aria-hidden>{children}</div>
      </>
    );
  }
  const user = me.data ? { id: me.data.id } : null;
  const account = me.data ? { name: me.data.name, email: me.data.email } : null;
  return (
    <ReaderShell user={user} sets={sets.data ?? []} account={account}>
      {children}
    </ReaderShell>
  );
}
