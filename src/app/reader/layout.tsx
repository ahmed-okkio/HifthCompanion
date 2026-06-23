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

  const { data: sets } = user
    ? await supabase
        .from('annotation_sets')
        .select('id, name')
        .order('created_at', { ascending: false })
    : { data: [] };

  return (
    <ReaderShell user={user} sets={sets ?? []}>
      {children}
    </ReaderShell>
  );
}
