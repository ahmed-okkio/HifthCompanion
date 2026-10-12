'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter, notFound } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useHydrated } from '@/lib/i18n/usePathname';
import { getPageImageUrl, TOTAL_PAGES, parseSpread } from '@/lib/quran';
import { createClient } from '@/lib/supabase/client';
import { createAnnotationStore } from '@/lib/annotationStore';
import { qk } from '@/lib/query/keys';
import { loadShareCap, type ShareCap } from '@/lib/share/reads';
import { useNotesQuery } from '@/hooks/useNotesQuery';
import QueryFallback from '@/components/QueryFallback';
import ReaderShell, { ReaderShellSkeleton } from '@/components/ReaderShell';
import ReadOnlyCanvas from '@/components/ReadOnlyCanvas';
import ShareShell from '@/components/ShareShell';
import ReaderTaskBanner from '@/components/ReaderTaskBanner';
import NotesPanel from '@/components/NotesPanel';
import SpreadNotesPanel from '@/components/SpreadNotesPanel';
import { useI18n } from '@/components/I18nProvider';

type Visible = Extract<ShareCap, { set: unknown }>;
const COLUMN = 'flex min-w-0 flex-col gap-4 lg:self-stretch lg:min-h-0 lg:max-h-full lg:overflow-y-auto lg:pr-1';
const SHIMMER = 'w-full rounded-md skeleton';

/**
 * Share route `/share/{setId}/{page}`: one static shell for every set and page (the proxy and SW
 * rewrite here, src/lib/shellRewrites.json; the visible URL is unchanged). Set and page come from
 * the URL once hydrated, and the viewer's capability is read client-side (RLS decides what is
 * visible; the shell holds no set data, C3). Page turns keep this component, so the collaborator's
 * ReaderShell + canvas stay mounted. Owner -> the reader; no access -> not found.
 */
export default function SharePage() {
  const hydrated = useHydrated();
  const [, , setId = '', page = ''] = usePathname().split('/');
  return hydrated ? <ShareView setId={setId} page={page} /> : <ReaderShellSkeleton />;
}

function ShareView({ setId, page }: { setId: string; page: string }) {
  const router = useRouter();
  // C6: legacy `/share/{userId}/{page}?set={setId}` goes to the canonical `/share/{setId}/{page}`.
  const legacy = useSearchParams().get('set');
  const spread = page.includes('-') ? parseSpread(page) : null;
  const malformed = page.includes('-') && !spread;
  const pageNum = spread ? spread[0] : parseInt(page, 10);
  const cap = useQuery({
    queryKey: qk.share(setId),
    queryFn: () => loadShareCap(createClient(), setId),
    enabled: !legacy && !malformed,
  });
  const to = legacy
    ? `/share/${legacy}/${page}`
    : malformed
      ? `/share/${setId}/${parseInt(page, 10) || 1}`
      : cap.data?.kind === 'owner'
        ? `/reader/${pageNum}?set=${setId}`
        : null;
  // From an effect: a render-time redirect() after hydration lands on the error boundary.
  useEffect(() => { if (to) router.replace(to); }, [to, router]);

  if (to) return <ReaderShellSkeleton />;
  if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) notFound();
  if (!cap.data) return <QueryFallback q={cap} skeleton={<ReaderShellSkeleton />} />;
  const c = cap.data;
  // [SEC] Not visible to this viewer (RLS): not found, never an empty or cached set.
  if (c.kind === 'none') notFound();
  if (c.kind === 'owner') return <ReaderShellSkeleton />;
  return c.kind === 'collaborator'
    ? <CollaboratorView c={c} setId={setId} pageNum={pageNum} spread={spread} />
    : <ReadOnlyView c={c} setId={setId} pageNum={pageNum} />;
}

/** C2/C3: editable canvas locked to this set (RLS grants the collaborator writes). */
function CollaboratorView({ c, setId, pageNum, spread }: { c: Visible; setId: string; pageNum: number; spread: [number, number] | null }) {
  const { t } = useI18n();
  const notesA = useNotesQuery(setId, pageNum);
  const notesB = useNotesQuery(setId, spread ? spread[1] : null);
  const pending = notesA.data === undefined ? notesA : spread && notesB.data === undefined ? notesB : null;

  const banner = (
    <div className="mb-4">
      <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-surface-main border border-subtle text-muted text-caption">
        <svg className="w-4 h-4 shrink-0 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span>{t('share.editingSetBanner', { owner: c.ownerName, name: c.set.name })}</span>
      </div>
    </div>
  );

  return (
    <ReaderShell
      user={{ id: c.userId! }}
      sets={[{ id: c.set.id, name: c.set.name }]}
      account={c.account}
      lockedSet
      banner={banner}
      sharePageBasePath={`/share/${setId}`}
    >
      {pending ? (
        <div className={COLUMN}><QueryFallback q={pending} skeleton={<div className={`${SHIMMER} h-45`} />} /></div>
      ) : (
        <div className="animate-fade-in-scale flex flex-col gap-3 [animation-delay:100ms]">
          {c.studentPath && (
            <a href={c.studentPath} className="btn btn-primary w-full transition-transform duration-150 hover:-translate-y-0.5 text-small">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span>{t('share.openStudentProfile')}</span>
            </a>
          )}
          {spread ? (
            <SpreadNotesPanel
              setId={setId}
              pages={spread}
              initialNotes={{ [pageNum]: notesA.data ?? [], [spread[1]]: notesB.data ?? [] }}
              currentUserId={c.userId}
            />
          ) : (
            <NotesPanel setId={setId} pageNum={pageNum} initialNotes={notesA.data ?? []} currentUserId={c.userId} />
          )}
        </div>
      )}
    </ReaderShell>
  );
}

/** C4/C5: read-only view (a covering substitute). */
function ReadOnlyView({ c, setId, pageNum }: { c: Visible; setId: string; pageNum: number }) {
  const { t } = useI18n();
  const anno = useQuery({
    queryKey: qk.annotation(setId, pageNum),
    queryFn: () => createAnnotationStore(createClient()).load(setId, pageNum),
  });
  const notes = useNotesQuery(setId, pageNum);

  return (
    <ShareShell basePath={`/share/${setId}`} pageNum={pageNum} setName={c.set.name} ownerName={c.ownerName} account={c.account}>
      <main className="w-full flex-grow px-4 pt-6 pb-[calc(1.5rem+env(safe-area-inset-bottom,0px))] sm:px-6 sm:pt-8 sm:pb-8 animate-fade-in lg:flex lg:flex-col lg:justify-center lg:min-h-0 lg:overflow-hidden lg:pb-8">
        <div className="mx-auto grid w-full max-w-330 grid-cols-1 gap-6 items-start lg:h-full lg:min-h-0 lg:items-start lg:grid-cols-[minmax(0,1fr)_minmax(240px,280px)] lg:justify-center">
          <div className="flex min-w-0 flex-col gap-4">
            {/* Opened from a homework/exam card — say what the page is for. */}
            <ReaderTaskBanner />
            <div className="mx-auto flex w-fit items-center gap-2 rounded-lg px-3 py-2 bg-surface-main border border-subtle text-muted text-caption">
              <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>{t('share.readOnlyLabel')}</span>
            </div>
            <div className="mx-auto w-full flex justify-center">
              {anno.data === undefined ? (
                <QueryFallback q={anno} skeleton={<div className={`${SHIMMER} aspect-[2/3] max-w-xl`} />} />
              ) : (
                <ReadOnlyCanvas pageNum={pageNum} imageUrl={getPageImageUrl(pageNum)} canvasJson={anno.data} setId={setId} notes={notes.data ?? []} />
              )}
            </div>
          </div>
          <div className={COLUMN}>
            {notes.data === undefined ? (
              <QueryFallback q={notes} skeleton={<div className={`${SHIMMER} h-45`} />} />
            ) : (
              <NotesPanel key={pageNum} setId={setId} pageNum={pageNum} initialNotes={notes.data} readOnly />
            )}
          </div>
        </div>
      </main>
    </ShareShell>
  );
}
