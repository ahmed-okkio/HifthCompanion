import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SetsList from '@/components/SetsList';
import { getAnnotationSets } from '@/lib/services/annotationSets';
import Link from 'next/link';

export default async function SetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const sets = await getAnnotationSets();

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* Header */}
      <header className="glass sticky top-0 z-50 border-b"
              style={{ borderColor: 'var(--border-subtle)', borderRadius: 0 }}>
        <div className="mx-auto flex items-center justify-between px-4 py-3 max-w-2xl">
          <Link href="/reader/1" className="flex items-center gap-2">
            <span className="text-base font-bold" style={{ color: 'var(--text-accent)' }}>
              حفظ
            </span>
            <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
              HifthCompanion
            </span>
          </Link>
          <Link href="/reader/1" className="btn btn-ghost" style={{ fontSize: '12px' }}>
            ← Back to Reader
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 animate-fade-in">
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
    </div>
  );
}
