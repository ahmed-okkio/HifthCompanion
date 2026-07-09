import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SetsList from '@/components/SetsList';
import { getAnnotationSets } from '@/lib/services/annotationSets';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { localizeDigits } from '@/lib/i18n/config';

export default async function SetsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const locale = await getLocale();
  const dict = getDictionary(locale);
  // E2: getAnnotationSets() is owner-scoped, so shared sets never leak into "My Annotation Sets".
  // Sets shared *with* the viewer live on /shared, not here.
  const sets = await getAnnotationSets();

  return (
    <>
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full" style={{ overflowY: 'auto', height: '100%' }}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
              {dict['sets.pageTitle']}
            </h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {dict['sets.pageSubtitle']}
            </p>
          </div>
          <span className="badge">{dict['sets.countBadge'].replace('{count}', localizeDigits(sets.length, locale))}</span>
        </div>
        <SetsList initialSets={sets} />
      </main>
      <footer
        className="w-full text-center text-xs tracking-wider uppercase border-t"
        style={{ padding: '10px 0', color: 'var(--text-muted)', borderColor: 'var(--border-subtle)', background: 'var(--bg-base)' }}
      >
        {dict['home.footer']}
      </footer>
    </>
  );
}
