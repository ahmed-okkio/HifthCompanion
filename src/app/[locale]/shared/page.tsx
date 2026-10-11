'use client';
import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { qk } from '@/lib/query/keys';
import { loadSharedWithMe } from '@/lib/share/reads';
import QueryFallback from '@/components/QueryFallback';
import { Sk } from '@/components/Skeleton';
import { useI18n } from '@/components/I18nProvider';

/** Static shell (PRD 0016 C2): the list is read client-side; auth is the proxy's (/shared is protected). */
export default function SharedPage() {
  const { t, fmtNum } = useI18n();
  const q = useQuery({ queryKey: qk.shared, queryFn: () => loadSharedWithMe(createClient()) });
  const shared = q.data;

  return (
    <>
      <main className="max-w-3xl mx-auto px-4 py-8 sm:py-10 animate-fade-in w-full overflow-y-auto h-full">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-primary">{t('nav.sharedMushafs')}</h1>
            <p className="text-xs mt-1 text-muted">{t('shared.pageSubtitle')}</p>
          </div>
          {shared ? <span className="badge">{t('shared.countBadge', { count: fmtNum(shared.length) })}</span> : <Sk w={64} h={24} r={999} />}
        </div>

        {!shared ? (
          <QueryFallback
            q={q}
            skeleton={<div className="flex flex-col gap-3">{[0, 1, 2].map((i) => <Sk key={i} h={52} r={16} />)}</div>}
          />
        ) : shared.length === 0 ? (
          <div className="card text-center px-6 py-8 text-muted">
            <p className="text-sm">{t('shared.emptyState')}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {shared.map((set) => (
              <a key={set.id} href={`/share/${set.id}`} className="card flex items-center gap-3 px-4 py-3">
                <div className="w-2 h-2 rounded-full flex-shrink-0 bg-accent" />
                <span className="font-medium text-sm truncate text-primary">{set.owner}</span>
                <span className="text-xs ml-auto flex-shrink-0 text-muted">{set.name}</span>
              </a>
            ))}
          </div>
        )}
      </main>
      <footer className="w-full text-center text-xs tracking-wider uppercase border-t py-2 text-muted border-subtle bg-surface-app">
        {t('home.footer')}
      </footer>
    </>
  );
}
