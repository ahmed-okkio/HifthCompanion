import { createClient } from '@/lib/supabase/server';
import { getPageImageUrl, TOTAL_PAGES } from '@/lib/quran';
import { notFound } from 'next/navigation';
import ReaderNav from '@/components/ReaderNav';
import AnnotationCanvas from '@/components/AnnotationCanvas';
import ShareButton from '@/components/ShareButton';
import NotesPanel from '@/components/NotesPanel';
import { getNotes } from '@/lib/services/notes';

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

  // Fetch notes for the first set on this page (notes panel shows for active set)
  const firstSetId = (sets ?? [])[0]?.id;
  const initialNotes = user && firstSetId
    ? await getNotes(firstSetId, pageNum).catch(() => [])
    : [];

  return (
    <div className="flex flex-col min-h-screen"
         style={{ background: 'var(--bg-base)' }}>
      <ReaderNav currentPage={pageNum} />
      
      <main className="w-full max-w-7xl mx-auto px-4 py-6 sm:py-8 flex-grow animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Main Canvas Area */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <AnnotationCanvas
              pageNum={pageNum}
              imageUrl={getPageImageUrl(pageNum)}
              sets={sets ?? []}
              user={user}
            />
          </div>

          {/* Sidebar Area */}
          <div className="lg:col-span-4 flex flex-col gap-4 lg:sticky lg:top-[88px]">
            {user && (sets ?? []).length > 0 && (
              <div className="card p-5 flex flex-col gap-3 animate-fade-in-scale" style={{ animationDelay: '100ms' }}>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Share Page</h3>
                  <p className="text-xs mt-1.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    Generate a read-only link to share your annotations and notes with others.
                  </p>
                </div>
                <div className="flex justify-end mt-1">
                  <ShareButton
                    userId={user.id}
                    pageNum={pageNum}
                    sets={sets ?? []}
                  />
                </div>
              </div>
            )}

            {user && firstSetId ? (
              <div className="animate-fade-in-scale" style={{ animationDelay: '200ms' }}>
                <NotesPanel
                  setId={firstSetId}
                  pageNum={pageNum}
                  initialNotes={initialNotes}
                />
              </div>
            ) : !user ? (
              <div className="card p-8 text-center flex flex-col items-center justify-center animate-fade-in-scale" style={{ animationDelay: '100ms' }}>
                <div className="text-4xl mb-4 opacity-50" style={{ filter: 'grayscale(1)' }}>🔒</div>
                <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Sign in to annotate</h3>
                <p className="text-sm mt-2 max-w-[240px]" style={{ color: 'var(--text-muted)' }}>
                  You must be logged in to draw on pages, create annotation sets, and save notes.
                </p>
                <a href="/login" className="btn btn-primary mt-6">
                  Log in / Sign up
                </a>
              </div>
            ) : (
              <div className="card p-6 text-center animate-fade-in-scale" style={{ animationDelay: '200ms' }}>
                <div className="text-3xl mb-3 opacity-50">📂</div>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No annotation sets</h3>
                <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                  Create a set to start taking notes.
                </p>
                <a href="/sets" className="btn btn-outline mt-4">
                  Create Set
                </a>
              </div>
            )}
          </div>
          
        </div>
      </main>

      <footer className="w-full py-6 text-center text-xs tracking-wider uppercase border-t"
              style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}>
        HifthCompanion © 2026
      </footer>
    </div>
  );
}
