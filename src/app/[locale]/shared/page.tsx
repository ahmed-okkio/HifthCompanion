import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { sharedWithMe } from '@/lib/services/collaborators';
import { getProfilesByIds } from '@/lib/services/profile';
import { displayName } from '@/lib/displayName';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { localizeDigits } from '@/lib/i18n/config';

export default async function SharedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const locale = await getLocale();
  const dict = getDictionary(locale);
  // sharedWithMe() is collaborator-scoped (set_collaborators.user_id = me), so
  // sets the viewer owns never appear here. Circle accept adds the grant.
  const shared = await sharedWithMe();
  const profiles = await getProfilesByIds(shared.map((s) => s.user_id));

  return (
    <>
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full overflow-y-auto h-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-primary">
              {dict['nav.sharedMushafs']}
            </h1>
            <p className="text-xs mt-1 text-muted">
              {dict['shared.pageSubtitle']}
            </p>
          </div>
          <span className="badge">{dict['shared.countBadge'].replace('{count}', localizeDigits(shared.length, locale))}</span>
        </div>

        {shared.length === 0 ? (
          <div className="card text-center px-6 py-8 text-muted">
            <p className="text-sm">{dict['shared.emptyState']}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shared.map((set) => {
              const p = profiles.get(set.user_id);
              const owner = displayName({ user_id: set.user_id, first_name: p?.first_name, last_name: p?.last_name });
              return (
                <a key={set.id} href={`/share/${set.id}`}
                   className="card flex items-center gap-3 px-4 py-3">
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-accent" />
                  <span className="font-medium text-sm truncate text-primary">
                    {owner}
                  </span>
                  <span className="text-xs ml-auto flex-shrink-0 text-muted">
                    {set.name}
                  </span>
                </a>
              );
            })}
          </div>
        )}
      </main>
      <footer
        className="w-full text-center text-xs tracking-wider uppercase border-t py-2 text-muted border-subtle bg-surface-app"
      >
        {dict['home.footer']}
      </footer>
    </>
  );
}
