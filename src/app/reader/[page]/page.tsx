import { createClient } from '@/lib/supabase/server';
import { TOTAL_PAGES, parseSpread } from '@/lib/quran';
import { notFound, redirect } from 'next/navigation';
import ShareCard from '@/components/ShareCard';
import NotesPanel from '@/components/NotesPanel';
import SpreadNotesPanel from '@/components/SpreadNotesPanel';
import { getNotes } from '@/lib/services/notes';
import type { Note } from '@/types';
import { Icon } from '@/components/tracker/ui';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';

interface Props {
  params: Promise<{ page: string }>;
  // `set` lets a teacher view a student's shared set (RLS-gated, read-only).
  searchParams: Promise<{ set?: string }>;
}

// The reader app-shell (persistent layout) owns the page navigation chrome and the Fabric
// annotation canvas, so they survive page-to-page navigation without remounting (Story 24).
// This route segment renders only the per-page notes / share column, which is allowed to
// remount so its server-fetched notes swap cleanly with the page.
export default async function ReaderPage({ params, searchParams }: Props) {
  const { page } = await params;
  const { set: requestedSet } = await searchParams;

  // Spread segment "N-M" (M2/G1): the notes column fetches the LOWER (right) page's
  // data via the exact same path single mode uses for that page. The second canvas is
  // lit up by ReaderShell in M3; this route only needs the lower page number here.
  // A single "3" has no dash → parseSpread isn't called, single behavior is untouched (B4).
  const spread = page.includes('-') ? parseSpread(page) : null;
  if (page.includes('-') && !spread) {
    // Malformed spread ("3-5", "5-3", garbage) → fall back to the first number's single page.
    const first = parseInt(page, 10);
    redirect(`/reader/${isNaN(first) ? 1 : first}`);
  }
  // ponytail: lower page feeds every existing fetch (G1); swap to per-active-page in M3.
  const pageNum = spread ? spread[0] : parseInt(page, 10);

  if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) {
    notFound();
  }

  const dict = getDictionary(await getLocale());
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // The reader's own chrome (set list, ShareCard) only ever shows the user's own
  // sets — cross-user RLS would otherwise mix in students' shared sets.
  const { data: sets } = user
    ? await supabase
        .from('annotation_sets')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
    : { data: [] };

  // Notes view: an explicit `?set=` (teacher viewing a shared set) wins; RLS
  // enforces read access. Otherwise the user's own first set.
  const viewSetId = requestedSet ?? (sets ?? [])[0]?.id;
  const initialNotes = user && viewSetId
    ? await getNotes(viewSetId, pageNum).catch(() => [])
    : [];
  // Spread: also fetch the OTHER page so both panels render server-side.
  const otherPage = spread ? spread[1] : null;
  const otherNotes: Note[] = user && viewSetId && otherPage
    ? await getNotes(viewSetId, otherPage).catch(() => [])
    : [];

  return (
    /* V3 Story 13 — Context panel order: Notes (top) → Share → Tags (Stories 14–15 follow).
       Notes card is always rendered first so it sits at the top of the 320px right panel. */
    <div className="flex min-w-0 flex-col gap-4 lg:self-stretch lg:min-h-0 lg:max-h-full lg:overflow-y-auto lg:pr-1">

      {/* ── 1. NOTES (top) ── */}
      {user && viewSetId ? (
        <div className="animate-fade-in-scale" style={{ animationDelay: '100ms' }}>
          {spread ? (
            <SpreadNotesPanel
              setId={viewSetId}
              pages={spread}
              initialNotes={{ [pageNum]: initialNotes, [otherPage!]: otherNotes }}
              currentUserId={user.id}
            />
          ) : (
            <NotesPanel setId={viewSetId} pageNum={pageNum} initialNotes={initialNotes} currentUserId={user.id} />
          )}
        </div>
      ) : !user ? (
        <div className="card p-8 text-center flex flex-col items-center justify-center animate-fade-in-scale" style={{ animationDelay: '100ms', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)' }}>
          <div className="mb-4 opacity-50" style={{ color: 'var(--text-muted)' }}><Icon name="lock" size={36} /></div>
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{dict['reader.signInToAnnotate']}</h3>
          <p className="text-sm mt-2 max-w-[240px]" style={{ color: 'var(--text-muted)' }}>
            {dict['reader.signInHint']}
          </p>
          <a href="/login" className="btn btn-primary mt-6">{dict['reader.logInSignUp']}</a>
        </div>
      ) : (
        <div className="card p-6 text-center animate-fade-in-scale" style={{ animationDelay: '100ms', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)' }}>
          <div className="mb-3 opacity-50" style={{ color: 'var(--text-muted)' }}><Icon name="folder" size={30} /></div>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{dict['reader.noAnnotationSets']}</h3>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            {dict['reader.createSetHint']}
          </p>
          <a href="/sets" className="btn btn-outline mt-4">{dict['sets.createSet']}</a>
        </div>
      )}

      {/* ── 2. SHARE (Story 14) — dedicated card, white surface / radius-lg / neutral-200 border / shadow-e1 ── */}
      {user && (sets ?? []).length > 0 && (
        <div className="animate-fade-in-scale" style={{ animationDelay: '200ms' }}>
          <ShareCard userId={user.id} pageNum={pageNum} sets={sets ?? []} />
        </div>
      )}

    </div>
  );
}
