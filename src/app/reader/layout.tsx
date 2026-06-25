import { createClient } from '@/lib/supabase/server';
import ReaderShell from '@/components/ReaderShell';

export const dynamic = 'force-dynamic';

export default async function ReaderLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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

  return (
    <ReaderShell user={user} sets={sets ?? []}>
      {children}
    </ReaderShell>
  );
}
