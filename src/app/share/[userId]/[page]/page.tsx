import { createClient } from '@/lib/supabase/server';
import { getPageImageUrl, TOTAL_PAGES } from '@/lib/quran';
import { notFound } from 'next/navigation';
import ReadOnlyCanvas from '@/components/ReadOnlyCanvas';
import ShareShell from '@/components/ShareShell';
import { getNotes } from '@/lib/services/notes';
import NotesPanel from '@/components/NotesPanel';
import { getMyChrome } from '@/lib/services/profile';

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

  // Auth-conditional chrome: a signed-in visitor gets the profile menu, a guest
  // viewer gets a Log In link (ADR 0002 D4).
  const { data: { user } } = await supabase.auth.getUser();
  const account = user ? await getMyChrome(user) : null;

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

  return (
    <ShareShell userId={userId} pageNum={pageNum} setId={setId} setName={annotationSet!.name} account={account}>
      <main className="w-full flex-grow px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-8 sm:pb-8 animate-fade-in lg:flex lg:flex-col lg:justify-center lg:min-h-0 lg:overflow-hidden lg:pb-8">
        <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-6 items-start lg:h-full lg:min-h-0 lg:items-start lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:justify-center">

          <div className="flex min-w-0 flex-col gap-4">
            {/* Read-only badge */}
            <div className="mx-auto flex w-fit items-center gap-2 rounded-lg px-3 py-2"
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

            <div className="mx-auto w-full flex justify-center">
              <ReadOnlyCanvas
                pageNum={pageNum}
                imageUrl={imageUrl}
                canvasJson={annotation?.canvas_json ?? null}
              />
            </div>
          </div>

          <div className="flex min-w-0 flex-col gap-4 lg:self-stretch lg:min-h-0 lg:max-h-full lg:overflow-y-auto lg:pr-1">
            <NotesPanel
              setId={setId}
              pageNum={pageNum}
              initialNotes={initialNotes}
              readOnly
            />
          </div>

        </div>
      </main>
    </ShareShell>
  );
}
