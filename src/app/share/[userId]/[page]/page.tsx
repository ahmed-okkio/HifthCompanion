import { createClient } from '@/lib/supabase/server';
import { getPageImageUrl, TOTAL_PAGES, clampPage } from '@/lib/quran';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import ReadOnlyCanvas from '@/components/ReadOnlyCanvas';
import SurahNavPanel from '@/components/SurahNavPanel';
import { getNotes } from '@/lib/services/notes';
import NotesPanel from '@/components/NotesPanel';

interface Props {
  params: Promise<{ userId: string; page: string }>;
  searchParams: Promise<{ set?: string }>;
}

export default async function SharePage({ params, searchParams }: Props) {
  const { userId, page } = await params;
  const { set: setId } = await searchParams;

  const pageNum = parseInt(page, 10);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) notFound();
  if (!setId) notFound();

  // In E2E mode the mock DB doesn't share state across server requests,
  // so we skip ownership verification and render the page with a placeholder set name.
  const isE2E = process.env.PLAYWRIGHT_TEST === 'true';

  const supabase = await createClient();

  let annotationSet: { id: string; name: string; user_id: string } | null = null;

  if (isE2E) {
    annotationSet = { id: setId, name: 'Shared Set', user_id: userId };
  } else {
    const { data, error: setError } = await supabase
      .from('annotation_sets')
      .select('id, name, user_id')
      .eq('id', setId)
      .eq('user_id', userId)
      .maybeSingle();
    if (setError || !data) notFound();
    annotationSet = data;
  }

  // Fetch annotation for this page
  const { data: annotation } = await supabase
    .from('annotations')
    .select('canvas_json')
    .eq('set_id', setId)
    .eq('page_number', pageNum)
    .maybeSingle();
    
  const initialNotes = await getNotes(setId, pageNum).catch(() => []);
    
  const imageUrl = getPageImageUrl(pageNum);

  const prevPage = clampPage(pageNum - 1);
  const nextPage = clampPage(pageNum + 1);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
     <div className="hidden lg:block">
       <SurahNavPanel currentPage={pageNum} basePath={`/share/${userId}`} topOffset={52} />
     </div>
     {/* Share header */}
     <header className="glass sticky top-0 z-50 w-full"
             style={{ borderBottom: '1px solid var(--border-subtle)', borderRadius: 0 }}>
       <div className="mx-auto grid items-center gap-3 px-4 py-2.5 max-w-4xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
         <div className="flex min-w-0 items-center justify-start gap-3">
           <Link href={`/share/${userId}/${prevPage}?set=${setId}`}>
             <button
               disabled={pageNum === 1}
               className="btn btn-ghost flex items-center gap-1"
               style={{ padding: '4px 10px', fontSize: '12px' }}
             >
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
               </svg>
               Prev
             </button>
           </Link>

           <div className="flex items-center gap-1.5 tabular-nums text-sm font-bold"
                style={{ color: 'var(--text-primary)' }}>
             <span>{pageNum}</span>
             <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>/</span>
             <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{TOTAL_PAGES}</span>
           </div>

           <Link href={`/share/${userId}/${nextPage}?set=${setId}`}>
             <button
               disabled={pageNum === TOTAL_PAGES}
               className="btn btn-ghost flex items-center gap-1"
               style={{ padding: '4px 10px', fontSize: '12px' }}
             >
               Next
               <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
               </svg>
             </button>
           </Link>
         </div>

         <div className="flex min-w-0 items-center justify-center gap-2.5">
           <span className="badge">{annotationSet!.name}</span>
           <span className="badge badge-muted">Read-only</span>
         </div>

         <div className="flex min-w-0 items-center justify-end">
         <Link href="/reader/1"
               className="btn btn-outline flex items-center gap-1"
               style={{ padding: '4px 12px', fontSize: '12px' }}>
           Open Reader
           <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
           </svg>
         </Link>
         </div>
       </div>
     </header>
     <div className="flex min-h-screen flex-col items-center">

      <main className="relative w-full max-w-4xl px-3 py-5 flex-grow sm:px-4 animate-fade-in lg:max-w-[1360px]">
        {/* Read-only badge */}
        <div className="mx-auto mb-3 flex w-fit items-center gap-2 rounded-lg px-3 py-2"
             style={{
               background: 'var(--bg-card)',
               border: '1px solid var(--border-subtle)',
               color: 'var(--text-muted)',
               fontSize: '12px',
             }}>
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <span>Shared annotation — read-only</span>
        </div>

        <div className="relative w-full">
          <div className="flex justify-center">
            <ReadOnlyCanvas
              pageNum={pageNum}
              imageUrl={imageUrl}
              canvasJson={annotation?.canvas_json ?? null}
            />
          </div>

          <aside className="hidden lg:block absolute right-0 top-0 w-[280px]">
            <NotesPanel
              setId={setId}
              pageNum={pageNum}
              initialNotes={initialNotes}
              readOnly
            />
          </aside>
        </div>
      </main>

      <footer className="w-full py-5 text-center text-xs tracking-wider uppercase"
              style={{ color: 'var(--text-muted)', background: 'var(--bg-base)' }}>
        HifthCompanion © 2026
      </footer>
      </div>
    </div>
  );
}
