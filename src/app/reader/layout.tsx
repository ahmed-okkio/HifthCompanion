import { Suspense } from 'react';
import { createClient } from '@/lib/supabase/server';
import ReaderShell, { ReaderShellSkeleton } from '@/components/ReaderShell';
import { getMyChrome } from '@/lib/services/profile';

export const dynamic = 'force-dynamic';

/**
 * Reader layout. Kept SYNC so entering the reader paints an instant skeleton instead of
 * a blank delay: the data-dependent shell (auth + sets + chrome) is fetched in a streamed
 * child under <Suspense>, so ReaderShellSkeleton shows immediately and the real shell
 * streams in. ReaderShellData sits ABOVE the [page] segment, so page turns don't re-run
 * it (canvas stays mounted, no skeleton flash on navigation).
 */
export default function ReaderLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <Suspense fallback={<ReaderShellSkeleton />}>
      <ReaderShellData>{children}</ReaderShellData>
    </Suspense>
  );
}

async function ReaderShellData({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Own sets only — cross-user RLS would otherwise surface students' shared sets
  // in every reader's set picker. The teacher's shared-set view loads via ?set=.
  const { data: sets } = user
    ? await supabase
        .from('annotation_sets')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  const account = user ? await getMyChrome(user) : null;

  return (
    <ReaderShell user={user} sets={sets ?? []} account={account}>
      {children}
    </ReaderShell>
  );
}
