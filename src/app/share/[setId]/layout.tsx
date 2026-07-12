import ReaderShell from '@/components/ReaderShell';
import { resolveShareCapability } from '@/lib/services/share';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';

export const dynamic = 'force-dynamic';

/**
 * Persistent share layout. For a COLLABORATOR it hoists ReaderShell here (above the [page]
 * segment) so the annotation canvas + surah chrome survive page turns — the same soft-swap the
 * reader gets from reader/layout.tsx, instead of remounting the whole shell on every nav.
 * Owner (page redirects) and guest read-only (page renders ShareShell) pass through bare.
 */
export default async function ShareLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ setId: string }>;
}) {
  const { setId } = await params;
  const cap = await resolveShareCapability(setId);

  if (cap.kind !== 'collaborator') return <>{children}</>;

  const dict = getDictionary(await getLocale());
  const { user, annotationSet, account, ownerName } = cap;

  const banner = (
    <div className="relative flex w-full items-center justify-center gap-2">
      <div
        className="flex items-center gap-2 rounded-lg px-3 py-2"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', fontSize: '12px' }}
      >
        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
        <span>{dict['share.editingSetBanner'].replace('{owner}', ownerName).replace('{name}', annotationSet.name)}</span>
      </div>
    </div>
  );

  return (
    <ReaderShell
      user={{ id: user.id }}
      sets={[{ id: annotationSet.id, name: annotationSet.name }]}
      account={account}
      lockedSet
      banner={banner}
      sharePageBasePath={`/share/${setId}`}
    >
      {children}
    </ReaderShell>
  );
}
