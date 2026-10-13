'use client';
import { useEffect } from 'react';
import { useSearchParams, useRouter, notFound } from 'next/navigation';
import { usePathname, useHydrated } from '@/lib/i18n/usePathname';
import QueryFallback from '@/components/QueryFallback';
import { useNotesQuery } from '@/hooks/useNotesQuery';
import { TOTAL_PAGES, parseSpread } from '@/lib/quran';
import ShareCard from '@/components/ShareCard';
import NotesPanel from '@/components/NotesPanel';
import SpreadNotesPanel from '@/components/SpreadNotesPanel';
import { Icon } from '@/components/tracker/ui';
import MobileSheet from '@/components/MobileSheet';
import { SETS_ENABLED } from '@/lib/features';
import { PanelIcon, ICON_PATHS } from '@/components/PanelCard';
import { useI18n } from '@/components/I18nProvider';
import { useReaderData } from '@/components/ReaderLayoutClient';

const COLUMN = 'flex min-w-0 flex-col gap-4 lg:self-stretch lg:min-h-0 lg:max-h-full lg:overflow-y-auto lg:pr-1';
const SHIMMER = 'w-full rounded-md skeleton';

function NotesColumnSkeleton() {
  return (
    <div className={COLUMN}>
      <div className={`${SHIMMER} h-45`} />
      <div className={`${SHIMMER} h-24`} />
    </div>
  );
}

// The reader app-shell (persistent layout) owns the page navigation chrome and the Fabric
// annotation canvas. This segment renders only the per-page notes / share column. Static shell
// for every /reader/<n> (the proxy rewrites here, src/lib/shellRewrites.json): the page number
// comes from the visible URL once hydrated, and all data is read client-side.
export default function ReaderPage() {
  const hydrated = useHydrated();
  const page = usePathname().split('/')[2] ?? '';
  // A malformed spread "N-x" falls back to N's single page. Replaced from an effect: a render-time
  // redirect() after hydration lands on the error boundary instead.
  const fix = hydrated && page.includes('-') && !parseSpread(page) ? `/reader/${parseInt(page, 10) || 1}` : null;
  const router = useRouter();
  useEffect(() => { if (fix) router.replace(fix); }, [fix, router]);
  return hydrated && !fix ? <ReaderPageColumn page={page} /> : <NotesColumnSkeleton />;
}

function ReaderPageColumn({ page }: { page: string }) {
  const { t } = useI18n();
  // `set` lets a teacher view a student's shared set (RLS-gated, read-only).
  const requestedSet = useSearchParams().get('set');

  // Spread segment "N-M": the notes column shows both pages (malformed ones redirect above).
  const spread = page.includes('-') ? parseSpread(page) : null;
  const pageNum = spread ? spread[0] : parseInt(page, 10);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) notFound();
  const otherPage = spread ? spread[1] : null;

  const { me, sets: setsQ, ready } = useReaderData();
  const user = me.data;
  const sets = setsQ.data ?? [];
  // Notes view: an explicit `?set=` wins; otherwise the user's own first set.
  const viewSetId = user ? (requestedSet ?? sets[0]?.id) : undefined;
  const notesA = useNotesQuery(viewSetId, pageNum);
  const notesB = useNotesQuery(viewSetId, otherPage);

  if (!ready) return <NotesColumnSkeleton />;
  const pendingNotes = notesA.data === undefined ? notesA : otherPage && notesB.data === undefined ? notesB : null;

  return (
    /* V3 Story 13 — Context panel order: Notes (top) → Share → Tags. */
    <div className={COLUMN}>

      {/* ── 1. NOTES (top) ── */}
      {user && viewSetId ? (
        // MobileSheet stays mounted while notes load, so its mobile button doesn't pop in and
        // shove Share sideways on every page flip. lg-only animation: a transformed ancestor
        // would trap MobileSheet's position:fixed sheet.
        <div className="lg:animate-fade-in-scale lg:[animation-delay:100ms]">
          <MobileSheet testid="notes-card" icon={<PanelIcon d={ICON_PATHS.note} />} label={t('notes.title')}>
            {pendingNotes ? (
              <QueryFallback q={pendingNotes} skeleton={<div className={`${SHIMMER} h-45`} />} />
            ) : spread ? (
              <SpreadNotesPanel
                setId={viewSetId}
                pages={spread}
                initialNotes={{ [pageNum]: notesA.data ?? [], [otherPage!]: notesB.data ?? [] }}
                currentUserId={user.id}
              />
            ) : (
              <NotesPanel setId={viewSetId} pageNum={pageNum} initialNotes={notesA.data ?? []} currentUserId={user.id} />
            )}
          </MobileSheet>
        </div>
      ) : !user ? (
        <div className="card p-8 text-center flex flex-col items-center justify-center animate-fade-in-scale [animation-delay:100ms] bg-white/82 backdrop-blur-lg">
          <div className="mb-4 opacity-50 text-muted"><Icon name="lock" size={36} /></div>
          <h3 className="text-body font-semibold text-primary">{t('reader.signInToAnnotate')}</h3>
          <p className="text-small mt-2 max-w-60 text-muted">{t('reader.signInHint')}</p>
          <a href="/login" className="btn btn-primary mt-6">{t('reader.logInSignUp')}</a>
        </div>
      ) : (
        <div className="card p-6 text-center animate-fade-in-scale [animation-delay:100ms] bg-white/82 backdrop-blur-lg">
          <div className="mb-3 opacity-50 text-muted"><Icon name="folder" size={30} /></div>
          <h3 className="text-body font-semibold text-primary">{t('reader.noAnnotationSets')}</h3>
          <p className="text-caption mt-1.5 text-muted">{t('reader.createSetHint')}</p>
          {SETS_ENABLED && <a href="/sets" className="btn btn-outline mt-4">{t('sets.createSet')}</a>}
        </div>
      )}

      {/* ── 2. SHARE (Story 14) ── */}
      {user && sets.length > 0 && (
        // lg-only: a transformed ancestor would trap ShareCard's position:fixed mobile sheet.
        <div className="lg:animate-fade-in-scale lg:[animation-delay:200ms]">
          <ShareCard userId={user.id} pageNum={pageNum} sets={sets} />
        </div>
      )}

    </div>
  );
}
