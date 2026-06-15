# Slice 4 — Canvas Annotation Layer (Pen Tool + Save/Restore)

## Goal
Logged-in users can draw freehand on a Quran page within a selected annotation set. Annotations auto-save and restore on return.

---

## Dependencies
```bash
npm install fabric
npm install --save-dev @types/fabric
```

> Use Fabric.js v5 (not v6 — v6 has breaking API changes and less community support as of 2025).

---

## Database Migration

```sql
create table annotations (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references annotation_sets(id) on delete cascade,
  page_number integer not null check (page_number >= 1 and page_number <= 604),
  canvas_json jsonb,
  updated_at timestamptz not null default now(),
  unique (set_id, page_number)
);

alter table annotations enable row level security;

-- Users can only access annotations belonging to their sets
create policy "Users can manage annotations in their sets"
  on annotations
  for all
  using (
    exists (
      select 1 from annotation_sets
      where annotation_sets.id = annotations.set_id
        and annotation_sets.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from annotation_sets
      where annotation_sets.id = annotations.set_id
        and annotation_sets.user_id = auth.uid()
    )
  );

-- Allow read-only access to annotations via shared sets (for slice 9)
-- Add this later in slice 9; skip for now.
```

---

## Types: add to `types/index.ts`
```ts
export interface Annotation {
  id: string;
  set_id: string;
  page_number: number;
  canvas_json: object | null;
  updated_at: string;
}
```

---

## Implementation

### Update `app/reader/[page]/page.tsx`
Wrap the existing reader page to include the canvas and toolbar. Make it a client component boundary by extracting canvas into a client component.

```tsx
// app/reader/[page]/page.tsx
import { createClient } from '@/lib/supabase/server';
import { getPageImageUrl, TOTAL_PAGES } from '@/lib/quran';
import { notFound } from 'next/navigation';
import ReaderNav from '@/components/ReaderNav';
import AnnotationCanvas from '@/components/AnnotationCanvas';

interface Props {
  params: { page: string };
}

export default async function ReaderPage({ params }: Props) {
  const pageNum = parseInt(params.page, 10);
  if (isNaN(pageNum) || pageNum < 1 || pageNum > TOTAL_PAGES) notFound();

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch user's annotation sets for the set-picker
  const { data: sets } = user
    ? await supabase.from('annotation_sets').select('id, name').order('created_at', { ascending: false })
    : { data: [] };

  return (
    <div className="flex flex-col items-center min-h-screen bg-stone-950">
      <ReaderNav currentPage={pageNum} />
      <main className="relative w-full max-w-2xl px-2 py-4">
        <AnnotationCanvas
          pageNum={pageNum}
          imageUrl={getPageImageUrl(pageNum)}
          sets={sets ?? []}
          user={user}
        />
      </main>
    </div>
  );
}
```

### `components/AnnotationCanvas.tsx`
```tsx
'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { createClient } from '@/lib/supabase/client';
import type { AnnotationSet } from '@/types';

interface Props {
  pageNum: number;
  imageUrl: string;
  sets: Pick<AnnotationSet, 'id' | 'name'>[];
  user: { id: string } | null;
}

const SAVE_DELAY_MS = 1500; // debounce

export default function AnnotationCanvas({ pageNum, imageUrl, sets, user }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricRef = useRef<fabric.Canvas | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const supabase = createClient();

  const [selectedSetId, setSelectedSetId] = useState<string>(sets[0]?.id ?? '');
  const [saving, setSaving] = useState(false);

  // Init Fabric canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const width = containerRef.current.offsetWidth;

    // Load the page image to get natural aspect ratio
    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      const height = (img.naturalHeight / img.naturalWidth) * width;

      const canvas = new fabric.Canvas(canvasRef.current!, {
        width,
        height,
        isDrawingMode: true,
      });

      // Set background image
      fabric.Image.fromURL(imageUrl, (fbImg) => {
        fbImg.scaleToWidth(width);
        canvas.setBackgroundImage(fbImg, canvas.renderAll.bind(canvas));
      });

      // Default brush
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = 2;
      canvas.freeDrawingBrush.color = '#ff0000';

      fabricRef.current = canvas;

      // Load saved annotation
      if (selectedSetId) loadAnnotation(canvas, selectedSetId, pageNum);
    };

    return () => {
      fabricRef.current?.dispose();
      fabricRef.current = null;
    };
  }, [pageNum, imageUrl]); // re-init on page change

  // Re-load annotation when set changes
  useEffect(() => {
    if (fabricRef.current && selectedSetId) {
      loadAnnotation(fabricRef.current, selectedSetId, pageNum);
    }
  }, [selectedSetId]);

  async function loadAnnotation(canvas: fabric.Canvas, setId: string, page: number) {
    const { data } = await supabase
      .from('annotations')
      .select('canvas_json')
      .eq('set_id', setId)
      .eq('page_number', page)
      .maybeSingle();

    // Clear existing drawings (keep background image)
    canvas.getObjects().forEach(obj => canvas.remove(obj));

    if (data?.canvas_json) {
      canvas.loadFromJSON(data.canvas_json, () => canvas.renderAll());
    } else {
      canvas.renderAll();
    }
  }

  const scheduleSave = useCallback(() => {
    if (!user || !selectedSetId || !fabricRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      const json = fabricRef.current!.toJSON();
      await supabase.from('annotations').upsert(
        { set_id: selectedSetId, page_number: pageNum, canvas_json: json, updated_at: new Date().toISOString() },
        { onConflict: 'set_id,page_number' }
      );
      setSaving(false);
    }, SAVE_DELAY_MS);
  }, [user, selectedSetId, pageNum]);

  // Attach save trigger after canvas is ready
  useEffect(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.on('path:created', scheduleSave);
    canvas.on('object:modified', scheduleSave);
    canvas.on('object:removed', scheduleSave);
    return () => {
      canvas.off('path:created', scheduleSave);
      canvas.off('object:modified', scheduleSave);
      canvas.off('object:removed', scheduleSave);
    };
  }, [scheduleSave]);

  return (
    <div>
      {/* Toolbar */}
      {user && sets.length > 0 && (
        <div className="flex items-center gap-3 mb-2 text-white text-sm">
          <label>Set:</label>
          <select
            value={selectedSetId}
            onChange={e => setSelectedSetId(e.target.value)}
            className="text-black rounded px-2 py-1"
          >
            {sets.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {saving && <span className="text-gray-400 text-xs">Saving…</span>}
        </div>
      )}
      {!user && (
        <p className="text-gray-400 text-sm mb-2">
          <a href="/login" className="underline">Log in</a> to annotate.
        </p>
      )}

      {/* Canvas container */}
      <div ref={containerRef} className="w-full">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
```

---

## Key Fabric.js Notes
- `canvas.toJSON()` serialises all objects + background — use this for `canvas_json`.
- `loadFromJSON` replaces the canvas state; call it only after clearing existing objects.
- The background image is part of the canvas JSON by default — that's fine, it will just re-confirm it on load.
- Fabric v5's `PencilBrush` is the freehand drawing tool used here; other tools in later slices extend from this.

---

## Free-tier Checklist
- ✅ `upsert` with `onConflict` avoids duplicate rows — stays within DB row limits
- ✅ `canvas_json` stored as `jsonb` — typical page annotation is 10–100KB, well within Supabase's 500MB free DB
- ✅ Debounced save (1.5s) minimises DB write frequency
- ✅ No Vercel serverless functions — all direct Supabase client calls

## Done When
A logged-in user can select an annotation set, draw on a page with the pen tool, navigate away, return, and see their drawing restored.
