import { createClient } from '@/lib/supabase/server';
import { getPageImageUrl, TOTAL_PAGES, parseSpread } from '@/lib/quran';
import { notFound, redirect } from 'next/navigation';
import ReadOnlyCanvas from '@/components/ReadOnlyCanvas';
import ShareShell from '@/components/ShareShell';
import ReaderShell from '@/components/ReaderShell';
import NotesPanel from '@/components/NotesPanel';
import { getNotes } from '@/lib/services/notes';
import { getMyChrome, getProfilesByIds } from '@/lib/services/profile';
import { displayName } from '@/lib/displayName';

export const dynamic = 'force-dynamic';

interface Props {
  params: Promise<{ setId: string; page: string }>;
  // Legacy `?set=` marks an old `/share/{userId}/{page}?set={setId}` link (C6).
  searchParams: Promise<{ set?: string }>;
}

/**
 * Consolidated share route `/share/{setId}/{page}`. Capability is resolved on the SERVER from
 * RLS visibility — the client never decides permissions; the capability only drives UI:
 *   - owner (set.user_id === viewer)        → OWNER       (C1, redirect into the normal reader)
 *   - visible but not owner (collaborator)  → COLLABORATOR (C2/C3, editable, locked to one set)
 *   - not visible / no viewer               → READ_ONLY    (C4/C5, guest read-only view)
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
  // The old route's path segment was a userId; the real set id lived in `?set=`.
  if (legacySet) redirect(`/share/${legacySet}/${page}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // E2E: the mock DB doesn't share state across server requests, so the set can't resolve.
  // Fall through to the READ_ONLY guest branch (the share spec clears cookies and asserts the
  // read-only canvas) with a placeholder set name.
  const isE2E = process.env.PLAYWRIGHT_TEST === 'true';

  // RLS gate: the row is visible iff the viewer owns the set or is a collaborator.
  const annotationSet = isE2E
    ? null
    : (
        await supabase
          .from('annotation_sets')
          .select('id, name, user_id')
          .eq('id', setId)
          .maybeSingle()
      ).data;

  // C1 — OWNER: hand off to the normal reader chrome (full set-swapper, editable).
  if (annotationSet && user && annotationSet.user_id === user.id) {
    redirect(`/reader/${pageNum}?set=${setId}`);
  }

  // C2/C3 — COLLABORATOR: set visible but viewer is not the owner. Editable canvas locked to this
  // one set (no swapper) with a banner naming the owner's Mushaf. Editing works because RLS grants
  // the collaborator INSERT/UPDATE on annotations/notes for this set.
  if (annotationSet && user) {
    const owner = (await getProfilesByIds([annotationSet.user_id])).get(annotationSet.user_id);
    const ownerName = displayName({
      user_id: annotationSet.user_id,
      first_name: owner?.first_name,
      last_name: owner?.last_name,
    });
    const account = await getMyChrome(user);
    const initialNotes = await getNotes(setId, pageNum).catch(() => []);

    const banner = (
      <div
        className="mx-auto flex w-fit items-center gap-2 rounded-lg px-3 py-2"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-muted)',
          fontSize: '12px',
        }}
      >
        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span>Editing <strong>{ownerName}</strong>&rsquo;s &ldquo;{annotationSet.name}&rdquo; — shared with you</span>
      </div>
    );

    return (
      <ReaderShell
        user={{ id: user.id }}
        sets={[{ id: annotationSet.id, name: annotationSet.name }]}
        account={account}
        lockedSet
        banner={banner}
        sharePageBasePath={`/share/${setId}`}
      >
        <div className="animate-fade-in-scale" style={{ animationDelay: '100ms' }}>
          <NotesPanel setId={setId} pageNum={pageNum} initialNotes={initialNotes} />
        </div>
      </ReaderShell>
    );
  }

  // C4/C5 — READ_ONLY (guest or signed-in non-grantee): the existing read-only experience.
  // ponytail: ReadOnlyCanvas reused as-is. Retiring it (the manifest's optional cleanup) is
  // deferred — out of scope for this slice; reusing it is the smallest correct path.
  const account = user ? await getMyChrome(user) : null;
  const setName = annotationSet?.name ?? 'Shared Set';

  const { data: annotation } = await supabase
    .from('annotations')
    .select('canvas_json')
    .eq('set_id', setId)
    .eq('page_number', pageNum)
    .maybeSingle();

  const initialNotes = await getNotes(setId, pageNum).catch(() => []);
  const imageUrl = getPageImageUrl(pageNum);

  return (
    <ShareShell basePath={`/share/${setId}`} pageNum={pageNum} setName={setName} account={account}>
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
