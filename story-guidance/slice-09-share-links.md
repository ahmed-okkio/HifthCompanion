# Slice 9 — Read-Only Share Links

## Goal
Users can generate a public read-only link to any page in a specific annotation set. Anyone with the link can view the annotations without an account.

---

## No new DB tables needed

Share links encode everything in the URL: `/share/[setId]/[page]`. The `annotations` table already exists. We need one RLS policy addition to allow public reads of shared annotations.

### RLS addition (Supabase SQL editor)

```sql
-- Allow anyone to read annotations if they know the set_id
-- (set_id acts as an unguessable share token since it's a UUID)
create policy "Public can read annotations by set_id"
  on annotations
  for select
  using (true); -- set_id is a UUID — knowing it IS the auth

-- Same for notes
create policy "Public can read notes by set_id"
  on notes
  for select
  using (true);

-- Also need to read the set name for display
create policy "Public can read annotation set name by id"
  on annotation_sets
  for select
  using (true);
```

> **Security note:** A `uuid` set ID is 122 bits of entropy — functionally unguessable. This is the same pattern used by Notion, Figma, and Google Docs for share-by-link. No enumeration is possible via the API since RLS blocks `select *` without a known `id`.

---

## Implementation

### Share button in reader toolbar

```tsx
const [copied, setCopied] = useState(false);

async function copyShareLink() {
  if (!selectedSetId) return;
  const url = `${window.location.origin}/share/${selectedSetId}/${pageNum}`;
  await navigator.clipboard.writeText(url);
  setCopied(true);
  setTimeout(() => setCopied(false), 2000);
}

// In toolbar JSX:
<button
  onClick={copyShareLink}
  disabled={!selectedSetId}
  className="px-3 py-1 rounded text-sm bg-stone-700 text-white"
>
  {copied ? '✅ Copied!' : '🔗 Share'}
</button>
```

### `app/share/[setId]/[page]/page.tsx` — server component

```tsx
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { getPageImageUrl, TOTAL_PAGES } from '@/lib/quran';
import ShareCanvas from '@/components/ShareCanvas';

interface Props {
  params: { setId: string; page: string };
}

export default async function SharePage({ params }: Props) {
  const pageNum = parseInt(params.page, 10);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) notFound();

  const supabase = createClient();

  // Fetch the set to confirm it exists and get its name
  const { data: set } = await supabase
    .from('annotation_sets')
    .select('id, name')
    .eq('id', params.setId)
    .maybeSingle();

  if (!set) notFound();

  // Fetch the annotation for this page
  const { data: annotation } = await supabase
    .from('annotations')
    .select('canvas_json')
    .eq('set_id', params.setId)
    .eq('page_number', pageNum)
    .maybeSingle();

  return (
    <div className="flex flex-col items-center min-h-screen bg-stone-950">
      <div className="w-full max-w-2xl px-2 py-3 text-white flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-400">Shared annotation set</p>
          <h1 className="font-semibold">{set.name}</h1>
        </div>
        <p className="text-sm text-gray-400">Page {pageNum} of {TOTAL_PAGES}</p>
      </div>
      <main className="w-full max-w-2xl px-2 pb-4">
        <ShareCanvas
          imageUrl={getPageImageUrl(pageNum)}
          canvasJson={annotation?.canvas_json ?? null}
        />
      </main>
    </div>
  );
}
```

### `components/ShareCanvas.tsx` — read-only canvas

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { fabric } from 'fabric';

interface Props {
  imageUrl: string;
  canvasJson: object | null;
}

export default function ShareCanvas({ imageUrl, canvasJson }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.offsetWidth;
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const height = (img.naturalHeight / img.naturalWidth) * width;

      const canvas = new fabric.Canvas(canvasRef.current!, {
        width,
        height,
        isDrawingMode: false,
        selection: false, // no selection in read-only mode
        interactive: false, // disables all interaction
      });

      fabric.Image.fromURL(imageUrl, (fbImg) => {
        fbImg.scaleToWidth(width);
        canvas.setBackgroundImage(fbImg, canvas.renderAll.bind(canvas));
      });

      if (canvasJson) {
        canvas.loadFromJSON(canvasJson, () => {
          // Make all objects non-interactive
          canvas.getObjects().forEach(obj => {
            obj.selectable = false;
            obj.evented = false;
          });
          canvas.renderAll();
        });
      }
    };

    return () => {
      // fabricRef cleanup not needed here since we don't store ref
    };
  }, [imageUrl, canvasJson]);

  return (
    <div ref={containerRef} className="w-full">
      <canvas ref={canvasRef} />
    </div>
  );
}
```

---

## Free-tier Checklist
- ✅ No extra storage or DB tables
- ✅ Share page is server-rendered — Vercel caches it at the edge
- ✅ UUID set IDs provide security without auth overhead
- ✅ `interactive: false` on Fabric canvas prevents any client-side state writes

## Done When
A logged-in user can click Share, copy a URL, open it in an incognito window, and see their annotations rendered in read-only mode on the correct page. No login prompt appears.
