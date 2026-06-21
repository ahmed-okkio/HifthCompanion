'use client';
import { useSearchParams } from 'next/navigation';
import { useState, useEffect, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { getPageImageUrl, TOTAL_PAGES } from '@/lib/quran';
import AnnotationCanvas from '@/components/AnnotationCanvas';
import NotesPanel from '@/components/NotesPanel';
import ShareButton from '@/components/ShareButton';
import type { AnnotationSet } from '@/types';

export default function ReaderClient() {
  const searchParams = useSearchParams();
  const rawPage = parseInt(searchParams.get('page') ?? '1', 10);
  const pageNum = isNaN(rawPage) ? 1 : Math.min(Math.max(rawPage, 1), TOTAL_PAGES);
  const imageUrl = getPageImageUrl(pageNum);

  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<{ id: string } | null | undefined>(undefined);
  const [sets, setSets] = useState<Pick<AnnotationSet, 'id' | 'name'>[]>([]);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase.auth.getUser().then((res: any) => setUser(res.data?.user ?? null));
  }, [supabase]);

  useEffect(() => {
    if (!user) { setSets([]); return; }
    supabase
      .from('annotation_sets')
      .select('id, name')
      .order('created_at', { ascending: false })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((res: any) => setSets(res.data ?? []));
  }, [user, supabase]);

  const firstSetId = sets[0]?.id;

  if (user === undefined) return null;

  return (
    <main className="w-full flex-grow px-4 py-6 sm:px-6 sm:py-8 animate-fade-in">
      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-6 items-start lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)_minmax(240px,280px)] lg:justify-center">
        <div aria-hidden className="hidden lg:block" />

        <div className="flex min-w-0 flex-col gap-4 lg:col-start-2">
          <div className="mx-auto w-full">
            <AnnotationCanvas
              pageNum={pageNum}
              imageUrl={imageUrl}
              sets={sets}
              user={user}
            />
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-[88px] lg:col-start-3">
          {user && sets.length > 0 && (
            <div className="card p-5 flex flex-col gap-3 animate-fade-in-scale" style={{ animationDelay: '100ms', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)' }}>
              <div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Share Page</h3>
                <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  Generate a read-only link to share your annotations and notes with others.
                </p>
              </div>
              <div className="flex justify-end mt-1">
                <ShareButton userId={user.id} pageNum={pageNum} sets={sets} />
              </div>
            </div>
          )}

          {user && firstSetId ? (
            <div className="animate-fade-in-scale" style={{ animationDelay: '200ms' }}>
              <NotesPanel setId={firstSetId} pageNum={pageNum} initialNotes={[]} />
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
            <div className="card p-6 text-center animate-fade-in-scale" style={{ animationDelay: '200ms', background: 'rgba(255,255,255,0.82)', backdropFilter: 'blur(16px)' }}>
              <div className="text-3xl mb-3 opacity-50">📂</div>
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No annotation sets</h3>
              <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                Create a set to start taking notes.
              </p>
              <a href="/sets" className="btn btn-outline mt-4">Create Set</a>
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
