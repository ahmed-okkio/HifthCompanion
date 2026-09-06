/**
 * One-off: re-upload the 604 Mushaf page PNGs with a long cache-control.
 *
 * Supabase storage stamps `cache-control: no-cache` on objects uploaded without an explicit
 * `cacheControl`, which is why flipping pages was slow: every image revalidated with the
 * origin on every single view, and Cloudflare wouldn't hold them at the edge either
 * (`cf-cache-status: MISS`). The files are content-immutable — 604 fixed pages that never
 * change — so they should be `immutable` with a one-year max-age.
 *
 * There is no metadata-only update in the storage API, so this re-PUTs each file. Bytes come
 * from public/quran-pages/, which is the same source the bucket was filled from.
 *
 * Dry run (lists what it would push, uploads nothing):
 *   npx tsx --env-file=.env.local scripts/set-page-cache-headers.ts
 * For real:
 *   npx tsx --env-file=.env.local scripts/set-page-cache-headers.ts --write
 *
 * Re-running is safe: upsert overwrites with identical bytes.
 *
 * RESULT (2026-09-06): this ran over all 604 files and the object metadata now reads
 * `cacheControl: max-age=31536000` — but the public endpoint STILL serves `cache-control:
 * no-cache`. Verified it is not this script's doing: a brand-new object uploaded with a valid
 * `cacheControl` serves `no-cache` too, and the response carries `sb-gateway-mode: direct`.
 * Supabase only honours stored cacheControl through its Smart CDN, which this project's plan
 * does not have; on the direct gateway every public object is `no-cache` so edits propagate at
 * once. Nothing here can change that — the fix is the service worker's cache-first page store
 * (public/sw.js), which bypasses the HTTP cache entirely.
 *
 * Kept, not deleted: the metadata is correct now, so the served header starts obeying it the
 * moment the project moves to a plan with Smart CDN. Re-run only if the bucket is refilled.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { createClient } from '@supabase/supabase-js';

const write = process.argv.includes('--write');
const BUCKET = 'tajweed';
const CACHE_CONTROL = '31536000, immutable';
const SOURCE_DIR = path.join(process.cwd(), 'public', 'quran-pages');
const TOTAL_PAGES = 604;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  let done = 0;
  const failures: string[] = [];

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    const name = `${String(page).padStart(3, '0')}.png`;
    const bytes = await readFile(path.join(SOURCE_DIR, name));

    if (!write) {
      if (page === 1) console.log(`[dry run] would upload ${TOTAL_PAGES} files to ${BUCKET}/ with cache-control: ${CACHE_CONTROL}`);
      continue;
    }

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(name, bytes, { contentType: 'image/png', cacheControl: CACHE_CONTROL, upsert: true });

    if (error) failures.push(`${name}: ${error.message}`);
    else done++;
    if (done && done % 50 === 0) console.log(`  ${done}/${TOTAL_PAGES}`);
  }

  if (!write) return;
  console.log(`uploaded ${done}/${TOTAL_PAGES}`);
  if (failures.length) {
    console.error(`${failures.length} failed:`);
    failures.forEach((f) => console.error('  ' + f));
    process.exitCode = 1;
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
