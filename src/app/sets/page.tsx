import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SetsList from '@/components/SetsList';
import { getAnnotationSets } from '@/lib/services/annotationSets';
import { sharedWithMe } from '@/lib/services/collaborators';
import AppShell from '@/components/AppShell';
import { getMyChrome } from '@/lib/services/profile';

export default async function SetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // E2: getAnnotationSets() is owner-scoped, so shared sets never leak into "My Annotation Sets".
  const sets = await getAnnotationSets();
  const shared = await sharedWithMe();
  const account = await getMyChrome(user);

  return (
    <AppShell user={account}>
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
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

        {shared.length > 0 && (
          <section className="mt-10">
            <h2 className="text-xl font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Shared with me
            </h2>
            <div className="flex flex-col gap-3">
              {shared.map((set) => (
                // E1/C2: lands on the editable collaborator share view.
                <a key={set.id} href={`/share/${set.id}`}
                   className="card flex items-center gap-3"
                   style={{ padding: '14px 18px' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                  <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {set.name}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer
        className="w-full text-center text-xs tracking-wider uppercase border-t"
        style={{ padding: '10px 0', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
      >
        HifthCompanion © 2026
      </footer>
    </AppShell>
  );
}
