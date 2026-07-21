import { createClient } from '@/lib/supabase/server';
import { createAnnotationStore } from '@/lib/annotationStore';
import { getPageImageUrl, TOTAL_PAGES, parseSpread } from '@/lib/quran';
import { notFound, redirect } from 'next/navigation';
import ReadOnlyCanvas from '@/components/ReadOnlyCanvas';
import ShareShell from '@/components/ShareShell';
import NotesPanel from '@/components/NotesPanel';
import SpreadNotesPanel from '@/components/SpreadNotesPanel';
import type { Note } from '@/types';
import { getNotes } from '@/lib/services/notes';
import { resolveShareCapability } from '@/lib/services/share';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ setId: string; page: string }>;
  // Legacy `?set=` marks an old `/share/{userId}/{page}?set={setId}` link (C6).
  searchParams: Promise<{ set?: string }>;
}

/**
 * Consolidated share route `/share/{setId}/{page}`. Capability comes from RLS visibility
 * (resolveShareCapability, shared with the layout). For a COLLABORATOR the persistent ReaderShell
 * lives in the layout, so this route renders only the per-page notes column (soft-swaps, no
 * remount). Owner redirects into the reader; guest gets the read-only ShareShell + canvas.
 */
export default async function SharePage({ params, searchParams }: Props) {
  const { setId, page } = await params;
  const { set: legacySet } = await searchParams;

  // Spread segment "N-M" mirrors the reader route: the notes column tracks the LOWER page,
  // ReaderShell lights up the second canvas from the URL. Malformed spread → single fallback.
  const spread = page.includes('-') ? parseSpread(page) : null;
  if (page.includes('-') && !spread) {
    const first = parseInt(page, 10);
    redirect(`/share/${setId}/${isNaN(first) ? 1 : first}`);
  }
  const pageNum = spread ? spread[0] : parseInt(page, 10);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) notFound();

  // C6 — legacy link `/share/{userId}/{page}?set={setId}` 301s to canonical `/share/{setId}/{page}`.
  if (legacySet) redirect(`/share/${legacySet}/${page}`);

  const cap = await resolveShareCapability(setId);

  // C1 — OWNER: hand off to the normal reader chrome (full set-swapper, editable).
  if (cap.kind === 'owner') redirect(`/reader/${pageNum}?set=${setId}`);

  // C2/C3 — COLLABORATOR: ReaderShell is provided by the layout; render only the notes column
  // (it slots into ReaderShell's right context panel). Editing works because RLS grants the
  // collaborator INSERT/UPDATE on annotations/notes for this set.
  if (cap.kind === 'collaborator') {
    const dict = getDictionary(await getLocale());
    const initialNotes = await getNotes(setId, pageNum).catch(() => []);
    const otherNotes: Note[] = spread ? await getNotes(setId, spread[1]).catch(() => []) : [];
    // Only so a collaborator's own notes read as "you" (D6).
    const { data: { user } } = await (await createClient()).auth.getUser();

    return (
      <div className="animate-fade-in-scale flex flex-col gap-3" style={{ animationDelay: '100ms' }}>
        {cap.studentPath && (
          <a
            href={cap.studentPath}
            className="btn btn-primary w-full transition-transform duration-150 hover:-translate-y-0.5"
            style={{ fontSize: '13px' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>{dict['share.openStudentProfile']}</span>
          </a>
        )}
        {spread ? (
          <SpreadNotesPanel
            setId={setId}
            pages={spread}
            initialNotes={{ [pageNum]: initialNotes, [spread[1]]: otherNotes }}
            currentUserId={user?.id}
          />
        ) : (
          <NotesPanel setId={setId} pageNum={pageNum} initialNotes={initialNotes} currentUserId={user?.id} />
        )}
      </div>
    );
  }

  // C4/C5 — READ_ONLY (guest or signed-in non-grantee): the existing read-only experience.
  const setName = cap.annotationSet?.name ?? 'Shared Set';
  const supabase = await createClient();
  const store = createAnnotationStore(supabase);
  const annotationJson = await store.load(setId, pageNum).catch(() => null);
  const initialNotes = await getNotes(setId, pageNum).catch(() => []);
  const imageUrl = getPageImageUrl(pageNum);

  return (
    <ShareShell basePath={`/share/${setId}`} pageNum={pageNum} setName={setName} ownerName={cap.ownerName} account={cap.account}>
      <main className="w-full flex-grow px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-8 sm:pb-8 animate-fade-in lg:flex lg:flex-col lg:justify-center lg:min-h-0 lg:overflow-hidden lg:pb-8">
        <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-6 items-start lg:h-full lg:min-h-0 lg:items-start lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:justify-center">

          <div className="flex min-w-0 flex-col gap-4">
            {/* Read-only badge */}
            <div className="mx-auto flex w-fit items-center gap-2 rounded-lg px-3 py-2"
                 style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px' }}>
              <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Shared annotation — read-only</span>
            </div>

            <div className="mx-auto w-full flex justify-center">
              <ReadOnlyCanvas
                pageNum={pageNum}
                imageUrl={imageUrl}
                canvasJson={annotationJson ?? null}
                setId={setId}
                notes={initialNotes}
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
