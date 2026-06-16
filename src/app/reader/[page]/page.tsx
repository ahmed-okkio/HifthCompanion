import { createClient } from '@/lib/supabase/server';
import { getPageImageUrl, TOTAL_PAGES } from '@/lib/quran';
import { notFound } from 'next/navigation';
import ReaderNav from '@/components/ReaderNav';
import AnnotationCanvas from '@/components/AnnotationCanvas';

interface Props {
  params: Promise<{ page: string }>;
}

export default async function ReaderPage({ params }: Props) {
  const { page } = await params;
  const pageNum = parseInt(page, 10);
  
  if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch user's annotation sets for the set-picker
  const { data: sets } = user
    ? await supabase
        .from('annotation_sets')
        .select('id, name')
        .order('created_at', { ascending: false })
    : { data: [] };

  return (
    <div className="flex flex-col items-center min-h-screen bg-stone-950">
      <ReaderNav currentPage={pageNum} />
      
      <main className="relative w-full max-w-2xl px-2 py-4 flex-grow">
        <AnnotationCanvas
          pageNum={pageNum}
          imageUrl={getPageImageUrl(pageNum)}
          sets={sets ?? []}
          user={user}
        />
      </main>

      <footer className="w-full py-6 text-center text-stone-500 text-xs tracking-wider uppercase bg-stone-950">
        HifthCompanion © 2026
      </footer>
    </div>
  );
}
