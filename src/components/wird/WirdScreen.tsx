'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { listWirds, memorizedPages, myRanges } from '@/lib/wirdRead';
import { qk } from '@/lib/query/keys';
import { useI18n } from '@/components/I18nProvider';
import { Sk } from '@/components/Skeleton';
import QueryFallback from '@/components/QueryFallback';
import { openingRef, closingRef } from './ref';
import WirdPager, { type WirdCardData } from './WirdPager';
import { portionEdit } from './PortionSheet';

/** Reads the caller's wirds in the browser (RLS boundary, PRD 0016 E1). */
async function fetchDaily() {
  const sb = createClient();
  const [wirds, ranges] = await Promise.all([listWirds(sb), myRanges(sb)]);
  // Memorized scope pages, for the form's 'what I've memorized' preset (K5/D10)
  // and its gap-skipping finish projection. 0 pages => preset unavailable.
  return { wirds, memorizedPages: memorizedPages(ranges) };
}

export default function WirdScreen() {
  const { locale } = useI18n();
  const q = useQuery({ queryKey: qk.wirdDaily, queryFn: fetchDaily });
  if (!q.data) return <QueryFallback q={q} skeleton={<WirdSkeleton />} />;
  const { wirds } = q.data;

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
      edit: portionEdit(w),
    };
  });

  return <WirdPager cards={cards} memorizedPages={q.data.memorizedPages} />;
}

// Instant skeleton — a single centred card standing in for the pager, sized like it.
export function WirdSkeleton() {
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

