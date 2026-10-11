import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { listWirds } from '@/lib/services/wird';
import { getMyMemorization } from '@/lib/services/profile';
import { getPageForAyah } from '@/lib/quran';
import { openingRef, closingRef } from '@/components/wird/ref';
import { Suspense } from 'react';
import { Sk } from '@/components/Skeleton';
import { defaultLocale, isLocale, type Locale } from '@/lib/i18n/config';
import { getDictionary } from '@/lib/i18n/dictionaries';
import WirdPager, { type WirdCardData } from '@/components/wird/WirdPager';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const dict = getDictionary(isLocale(locale) ? locale : defaultLocale);
  return { title: dict['wird.pageTitle'] };
}

/**
 * /wird — the daily screen (M5). Server-resolves each wird into a serializable
 * card (refs, ranges, progress, pages-to-go) via the M3 service + the validated
 * ref/rate helpers, then hands them to the client pager. No maths is redone
 * here beyond deriving pages-to-go / percent from the position the service
 * already computed (H11 — position → cycle_page_end).
 */
export default async function WirdPage({ params }: Props) {
  const { locale } = await params;
  // Static shell = layout chrome + skeleton; user data streams into this hole (PRD 0016 C4).
  return (
    <Suspense fallback={<WirdSkeleton />}>
      <WirdData locale={isLocale(locale) ? locale : defaultLocale} />
    </Suspense>
  );
}

// Instant skeleton — a single centred card standing in for the pager, sized like it.
function WirdSkeleton() {
  return (
    <main className="fit-screen w-full flex-1 min-h-0 flex flex-col items-center overflow-hidden">
      <div className="w-full flex-1 min-h-0 flex flex-col items-center px-4 pt-8 pb-4 max-w-130">
        <div className="w-full flex flex-col gap-2 mb-6">
          <Sk w={120} h={24} />
          <Sk w={160} h={13} />
        </div>
        {/* eslint-disable-next-line shadcn/no-inline-styles -- Sk takes style, not className */}
        <Sk w="100%" h="100%" r={20} style={{ flex: '1 1 0', minHeight: 0, maxHeight: 360 }} />
        <div className="flex gap-2 mt-4">
          {[0, 1, 2].map((i) => <Sk key={i} w={8} h={8} r={999} />)}
        </div>
      </div>
    </main>
  );
}

async function WirdData({ locale }: { locale: Locale }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const wirds = await listWirds();

  // Memorized scope span, for the form's 'what I've memorized' preset (K5/D10)
  // and its projection. 0 pages ⇒ the preset is unavailable and the form says
  // what to do instead.
  const { ranges } = await getMyMemorization();
  // Real pass length = distinct memorized pages (gap-skipping), for the form's
  // finish projection. Not the envelope span, which counts unmemorized gaps.
  const memorizedPageSet = new Set<number>();
  for (const r of ranges) {
    for (let p = getPageForAyah(r.surah, r.from); p <= getPageForAyah(r.surah, r.to); p += 1) memorizedPageSet.add(p);
  }
  const memorizedPages = [...memorizedPageSet].sort((a, b) => a - b);

  const cards: WirdCardData[] = wirds.map((w) => {
    // Progress is over the pass length (gap-skipping for memorized scope), not
    // the raw page span — a gappy memorized pass has fewer pages than its
    // envelope. read = length − remaining.
    const total = w.pass_length;
    const read = Math.max(0, total - w.pages_remaining);
    const pagesToGo = w.pages_remaining;
    const singlePage = w.portion_start === w.portion_end;
    return {
      id: w.id,
      name: w.name,
      scope:
        w.scope_source === 'memorized'
          ? { memorized: true as const }
          : { memorized: false as const, range: `${w.page_start}–${w.page_end}` },
      opening: openingRef(w.portion_start, locale).label,
      closing: closingRef(w.portion_end, locale).label,
      portionRange: singlePage ? `${w.portion_start}` : `${w.portion_start}–${w.portion_end}`,
      portionSinglePage: singlePage,
      pct: total > 0 ? Math.round((read / total) * 100) : 0,
      pagesToGo,
      doneToday: w.done_today,
      daysSinceLastDone: w.days_since_last_done,
      // Where the next portion begins (I2/I3), known before Done is tapped so
      // the all-done list shows it without waiting on the refresh.
      nextRef: openingRef(w.next_position, locale).label,
    };
  });

  // WirdPager renders every state: empty, all-done, and the card strip, plus
  // the create-wird affordance + form modal (M7).
  return <WirdPager cards={cards} memorizedPages={memorizedPages} />;
}
