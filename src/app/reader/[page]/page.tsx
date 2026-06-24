import { createClient } from '@/lib/supabase/server';
import { TOTAL_PAGES } from '@/lib/quran';
import { notFound } from 'next/navigation';
import ShareCard from '@/components/ShareCard';
import NotesPanel from '@/components/NotesPanel';
import TagsCard from '@/components/TagsCard';
import { getNotes } from '@/lib/services/notes';

interface Props {
  params: Promise<{ page: string }>;
}

// The reader app-shell (persistent layout) owns the page navigation chrome and the Fabric
// annotation canvas, so they survive page-to-page navigation without remounting (Story 24).
// This route segment renders only the per-page notes / share column, which is allowed to
// remount so its server-fetched notes swap cleanly with the page.
export default async function ReaderPage({ params }: Props) {
  const { page } = await params;
  const pageNum = parseInt(page, 10);

  if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) {
    notFound();
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: sets } = user
    ? await supabase
        .from('annotation_sets')
        .select('id, name')
        .order('created_at', { ascending: false })
    : { data: [] };

  const firstSetId = (sets ?? [])[0]?.id;
  const initialNotes = user && firstSetId
    ? await getNotes(firstSetId, pageNum).catch(() => [])
    : [];

  return (
    /* V3 Story 13 — Context panel order: Notes (top) → Share → Tags (Stories 14–15 follow).
       Notes card is always rendered first so it sits at the top of the 320px right panel. */
    <div className="flex min-w-0 flex-col gap-4 lg:self-stretch lg:min-h-0 lg:max-h-full lg:overflow-y-auto lg:pr-1">

      {/* ── 1. NOTES (top) ── */}
      {user && firstSetId ? (
        <div className="animate-fade-in-scale" style={{ animationDelay: '100ms' }}>
          <NotesPanel setId={firstSetId} pageNum={pageNum} initialNotes={initialNotes} />
        </div>
      ) : !user ? (
        <div className="card p-8 text-center flex flex-col items-center justify-center animate-fade-in-scale" style={{ animationDelay: '100ms', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)' }}>
          <div className="text-4xl mb-4 opacity-50" style={{ filter: 'grayscale(1)' }}>🔒</div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Sign in to annotate</h3>
          <p className="text-sm mt-2 max-w-[240px]" style={{ color: 'var(--text-muted)' }}>
            You must be logged in to draw on pages, create annotation sets, and save notes.
          </p>
          <a href="/login" className="btn btn-primary mt-6">Log in / Sign up</a>
        </div>
      ) : (
        <div className="card p-6 text-center animate-fade-in-scale" style={{ animationDelay: '100ms', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)' }}>
          <div className="text-3xl mb-3 opacity-50">📂</div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No annotation sets</h3>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            Create a set to start taking notes.
          </p>
          <a href="/sets" className="btn btn-outline mt-4">Create Set</a>
        </div>
      )}

      {/* ── 2. SHARE (Story 14) — dedicated card, white surface / radius-lg / neutral-200 border / shadow-e1 ── */}
      {user && (sets ?? []).length > 0 && (
        <div className="animate-fade-in-scale" style={{ animationDelay: '200ms' }}>
          <ShareCard userId={user.id} pageNum={pageNum} sets={sets ?? []} />
        </div>
      )}

      {/* ── 3. TAGS placeholder (Story 15) — inert chip display, no backend ── */}
      <div className="animate-fade-in-scale" style={{ animationDelay: '300ms' }}>
        <TagsCard />
      </div>

    </div>
  );
}
