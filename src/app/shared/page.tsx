import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { sharedWithMe } from '@/lib/services/collaborators';
import { getMyChrome, getProfilesByIds } from '@/lib/services/profile';
import { displayName } from '@/lib/displayName';

export default async function SharedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // sharedWithMe() is collaborator-scoped (set_collaborators.user_id = me), so
  // sets the viewer owns never appear here. Circle accept adds the grant.
  const shared = await sharedWithMe();
  const account = await getMyChrome(user);
  const profiles = await getProfilesByIds(shared.map((s) => s.user_id));

  return (
    <AppShell user={account}>
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Shared Mushafs
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Annotation sets others have shared with you
            </p>
          </div>
          <span className="badge">{shared.length} shared</span>
        </div>

        {shared.length === 0 ? (
          <div className="card text-center" style={{ padding: '32px 18px', color: 'var(--text-muted)' }}>
            <p className="text-sm">No one has shared a mushaf with you yet.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shared.map((set) => {
              const p = profiles.get(set.user_id);
              const owner = displayName({ user_id: set.user_id, first_name: p?.first_name, last_name: p?.last_name });
              return (
                <a key={set.id} href={`/share/${set.id}`}
                   className="card flex items-center gap-3"
                   style={{ padding: '14px 18px' }}>
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                  <span className="font-medium text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                    {set.name}
                  </span>
                  <span className="text-xs ml-auto flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                    {owner}
                  </span>
                </a>
              );
            })}
          </div>
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
