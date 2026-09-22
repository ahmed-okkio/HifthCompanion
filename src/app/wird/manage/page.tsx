import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { listWirds, listEntryDatesByWird } from '@/lib/services/wird';
import { getMyMemorization } from '@/lib/services/profile';
import { getPageForAyah } from '@/lib/quran';
import { getLocale } from '@/lib/i18n/server';
import { getDictionary } from '@/lib/i18n/dictionaries';
import ManageList, { type ManageRow } from '@/components/wird/ManageList';

export async function generateMetadata() {
  const dict = getDictionary(await getLocale());
  return { title: dict['wird.manageTitle'] };
}

/**
 * /wird/manage — edit or delete wirds, off the daily card so the card keeps its
 * single control (H10). Each row opens the shared WirdForm in edit mode or
 * soft-deletes; the daily screen is one tap away.
 */
export default async function WirdManagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const wirds = await listWirds();
  const entriesByWird = await listEntryDatesByWird();

  const { ranges } = await getMyMemorization();
  // Real pass length = distinct memorized pages (gap-skipping), for the form's
  // finish projection. Not the envelope span, which counts unmemorized gaps.
  const memorizedPageSet = new Set<number>();
  for (const r of ranges) {
    for (let p = getPageForAyah(r.surah, r.from); p <= getPageForAyah(r.surah, r.to); p += 1) memorizedPageSet.add(p);
  }
  const memorizedPages = memorizedPageSet.size;

  const rows: ManageRow[] = wirds.map((w) => ({
    id: w.id,
    name: w.name,
    scope_source: w.scope_source,
    page_start: w.page_start,
    page_end: w.page_end,
    pages_per_period: w.pages_per_period,
    period_days: w.period_days,
    doneDates: entriesByWird[w.id] ?? [],
  }));

  return <ManageList rows={rows} memorizedPages={memorizedPages} />;
}
