import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SetsList from '@/components/SetsList';
import { getAnnotationSets } from '@/lib/services/annotationSets';
import Link from 'next/link';
import ReaderBackLink from '@/components/ReaderBackLink';
import AppHeader from '@/components/AppHeader';

export default async function SetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const sets = await getAnnotationSets();

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)' }}>
      <AppHeader
        right={
          <>
            <Link href="/tracker" className="text-xs font-semibold" style={{ color: 'var(--text-accent)' }}>
              Tracker
            </Link>
            <ReaderBackLink />
          </>
        }
      />

      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 animate-fade-in">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              My Annotation Sets
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Organize your Quran annotations into named collections
            </p>
          </div>
          <span className="badge">{sets.length} sets</span>
        </div>
        <SetsList initialSets={sets} />
      </main>
      <footer
        className="w-full text-center text-xs tracking-wider uppercase border-t"
        style={{ padding: '10px 0', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
      >
        HifthCompanion © 2026
      </footer>
    </div>
  );
}
