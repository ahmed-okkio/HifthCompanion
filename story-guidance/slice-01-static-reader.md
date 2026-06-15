# Slice 1 — Static Quran Reader

## Goal
Users can navigate and read all 604 Tajweed Quran pages. No auth required.

## Pre-requisite: Upload Images to Supabase Storage (one-time setup)

Do NOT use `raw.githubusercontent.com` — it's rate-limited and unreliable for production. Instead, self-host the images in Supabase Storage (free tier gives 1GB; 604 PNGs ≈ 150–200MB total).

**Steps:**
1. Clone the repo locally:
   ```bash
   git clone https://github.com/QuranHub/quran-pages-images.git
   ```
2. Locate the Tajweed images — they are in `easyquran.com/hafs-tajweed/`. Filenames are zero-padded PNGs (e.g. `001.png` … `604.png`).
3. Create a **public** Supabase Storage bucket called `quran-pages`.
4. Upload all 604 files using the Supabase CLI:
   ```bash
   supabase storage cp --recursive ./easyquran.com/hafs-tajweed/ ss://quran-pages/tajweed/
   ```
5. Public URL pattern will be:
   ```
   https://<project-ref>.supabase.co/storage/v1/object/public/quran-pages/tajweed/001.png
   ```
6. Store this base URL in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_IMAGE_BASE_URL=https://<project-ref>.supabase.co/storage/v1/object/public/quran-pages/tajweed
   ```

> **Free tier note:** Supabase Storage free tier has 1GB and no egress limits for public buckets on hobby projects. 604 pages at ~300KB avg = ~180MB. Fits comfortably.

---

## Implementation

### Project Setup
```bash
npx create-next-app@latest quran-annotator --typescript --tailwind --app
cd quran-annotator
npm install @supabase/supabase-js
```

### Utility: `lib/quran.ts`
```ts
export const TOTAL_PAGES = 604;

export function getPageImageUrl(page: number): string {
  const padded = page.toString().padStart(3, '0');
  return `${process.env.NEXT_PUBLIC_IMAGE_BASE_URL}/${padded}.png`;
}

export function clampPage(page: number): number {
  return Math.max(1, Math.min(TOTAL_PAGES, page));
}
```

### Route: `app/reader/[page]/page.tsx`
```tsx
import { notFound } from 'next/navigation';
import { getPageImageUrl, TOTAL_PAGES, clampPage } from '@/lib/quran';
import ReaderNav from '@/components/ReaderNav';

interface Props {
  params: { page: string };
}

export default function ReaderPage({ params }: Props) {
  const pageNum = parseInt(params.page, 10);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) notFound();

  return (
    <div className="flex flex-col items-center min-h-screen bg-stone-950">
      <ReaderNav currentPage={pageNum} />
      <main className="w-full max-w-2xl px-2 py-4">
        <img
          src={getPageImageUrl(pageNum)}
          alt={`Quran page ${pageNum}`}
          className="w-full h-auto"
          priority // Next.js Image component: add priority for LCP
        />
      </main>
    </div>
  );
}
```

> Use Next.js `<Image>` component with `fill` or explicit `width`/`height` instead of `<img>` to get automatic optimisation on Vercel's free tier (unlimited image optimisations on hobby plan).

### Component: `components/ReaderNav.tsx`
```tsx
'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TOTAL_PAGES, clampPage } from '@/lib/quran';

export default function ReaderNav({ currentPage }: { currentPage: number }) {
  const router = useRouter();
  const [jumpInput, setJumpInput] = useState('');

  const go = (page: number) => router.push(`/reader/${clampPage(page)}`);

  return (
    <nav className="w-full max-w-2xl flex items-center justify-between px-2 py-3 text-white">
      <button onClick={() => go(currentPage - 1)} disabled={currentPage === 1}>
        ← Prev
      </button>
      <div className="flex items-center gap-2">
        <span>{currentPage} / {TOTAL_PAGES}</span>
        <input
          type="number"
          min={1}
          max={TOTAL_PAGES}
          value={jumpInput}
          onChange={e => setJumpInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') go(parseInt(jumpInput, 10));
          }}
          placeholder="Go to page"
          className="w-24 px-2 py-1 text-black rounded"
        />
      </div>
      <button onClick={() => go(currentPage + 1)} disabled={currentPage === TOTAL_PAGES}>
        Next →
      </button>
    </nav>
  );
}
```

### Redirect root to page 1
`app/page.tsx`:
```tsx
import { redirect } from 'next/navigation';
export default function Home() {
  redirect('/reader/1');
}
```

---

## Free-tier Checklist
- ✅ Supabase Storage public bucket — no auth needed for image reads
- ✅ Vercel hobby plan — Next.js Image optimisation included free
- ✅ No Supabase DB queries in this slice — zero database cost
- ✅ Static-ish pages — Vercel edge caches image responses

## Done When
Any visitor can open `/reader/1` through `/reader/604` and see the correct Tajweed page, with working prev/next buttons and jump-to-page input.
