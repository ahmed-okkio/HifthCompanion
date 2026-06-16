import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SetsList from '@/components/SetsList';
import { getAnnotationSets } from '@/lib/services/annotationSets';

export default async function SetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const sets = await getAnnotationSets();

  return (
    <div className="max-w-lg mx-auto mt-10 px-4">
      <h1 className="text-2xl font-bold mb-6">My Annotation Sets</h1>
      <SetsList initialSets={sets} />
    </div>
  );
}
