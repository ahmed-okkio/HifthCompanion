'use client';

import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/lib/supabase/client';
import { listEntryDatesByWird, listWirds, memorizedPages, myRanges } from '@/lib/wirdRead';
import { qk } from '@/lib/query/keys';
import { Sk } from '@/components/Skeleton';
import QueryFallback from '@/components/QueryFallback';
import ManageList, { type ManageRow } from './ManageList';

async function fetchManage() {
  const sb = createClient();
  const [wirds, entriesByWird, ranges] = await Promise.all([
    listWirds(sb), listEntryDatesByWird(sb), myRanges(sb),
  ]);
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
  return { rows, memorizedPages: memorizedPages(ranges) };
}

export default function ManageScreen() {
  const q = useQuery({ queryKey: qk.wirdManage, queryFn: fetchManage });
  if (!q.data) {
    return (
      <QueryFallback q={q} skeleton={
        <main className="w-full max-w-140 mx-auto pt-5 px-4 pb-8 flex flex-col gap-3">
          <Sk w={160} h={28} />
          {[0, 1].map((i) => <Sk key={i} w="100%" h={120} r={16} />)}
        </main>
      } />
    );
  }
  return <ManageList rows={q.data.rows} memorizedPages={q.data.memorizedPages} />;
}
