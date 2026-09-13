/**
 * One-off backfill: fill annotations.mark_colors for pages saved before the column
 * existed. Without it the Annotations panel shows a total with no colour chips until
 * the reader happens to re-save that page.
 *
 * Dry run (prints what would change, writes nothing):
 *   npx tsx --env-file=.env.local scripts/backfill-mark-colors.ts
 * For real:
 *   npx tsx --env-file=.env.local scripts/backfill-mark-colors.ts --write
 *
 * The counts are recomputed here with the SAME clustering the client uses on save —
 * clusterCount() merges the several strokes of one drawn mark — so the chips sum to the
 * badge beside them. A plain SQL `group by stroke` would count strokes instead and the
 * two would disagree. mark_count is rewritten from that same pass, which also corrects
 * rows still carrying the raw jsonb_array_length from before clustering existed.
 *
 * Re-running is safe: it only touches rows where mark_colors is still null.
 */
import { createClient } from '@supabase/supabase-js';

import { pruneDegenerate, clusterCount, clusterColors } from '../src/lib/markedPages';

const write = process.argv.includes('--write');
const PAGE_SIZE = 200;

type Row = {
  id: string;
  page_number: number;
  mark_count: number | null;
  canvas_json: { objects?: unknown[]; width?: number } | null;
};

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY required');
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let scanned = 0, changed = 0, countFixed = 0, from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from('annotations')
      .select('id, page_number, mark_count, canvas_json')
      .is('mark_colors', null)
      .order('id')
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const rows = (data ?? []) as Row[];
    if (rows.length === 0) break;

    for (const row of rows) {
      scanned++;
      const objects = pruneDegenerate((row.canvas_json?.objects ?? []) as any[]);
      if (objects.length === 0) continue;
      // Same gap the canvas uses on save: 3% of the canvas width, floor 16px.
      const gap = Math.max(16, Math.round((row.canvas_json?.width ?? 0) * 0.03));
      const colors = clusterColors(objects as any, gap);
      const count = clusterCount(objects as any, gap);
      if (Object.keys(colors).length === 0) continue;
      if (count !== row.mark_count) countFixed++;
      changed++;
      if (write) {
        const { error: upErr } = await supabase
          .from('annotations')
          .update({ mark_colors: colors, mark_count: count })
          .eq('id', row.id);
        if (upErr) throw upErr;
      } else {
        console.log(`page ${row.page_number}: ${row.mark_count} → ${count}`, colors);
      }
    }
    from += PAGE_SIZE;
  }

  console.log(
    `${write ? 'Wrote' : 'Would write'} ${changed} of ${scanned} rows` +
    (countFixed ? ` (${countFixed} also had a stale mark_count)` : '') +
    (write ? '' : '\nRe-run with --write to apply.'),
  );
}

main().catch(err => { console.error(err); process.exit(1); });
