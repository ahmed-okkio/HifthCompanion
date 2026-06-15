# Slice 8 — Notes / Comments on Selections

## Goal
Users can attach a written note to any canvas object (highlight, shape, pen stroke). Notes appear in a side panel listing all notes for the current page.

---

## Database Migration

```sql
create table notes (
  id uuid primary key default gen_random_uuid(),
  set_id uuid not null references annotation_sets(id) on delete cascade,
  page_number integer not null,
  fabric_object_id text not null, -- the 'id' property we'll assign to fabric objects
  body text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (set_id, page_number, fabric_object_id)
);

alter table notes enable row level security;

create policy "Users can manage notes in their sets"
  on notes
  for all
  using (
    exists (
      select 1 from annotation_sets
      where annotation_sets.id = notes.set_id
        and annotation_sets.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from annotation_sets
      where annotation_sets.id = notes.set_id
        and annotation_sets.user_id = auth.uid()
    )
  );
```

---

## Types: add to `types/index.ts`
```ts
export interface Note {
  id: string;
  set_id: string;
  page_number: number;
  fabric_object_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}
```

---

## Implementation

### Assign stable IDs to Fabric objects

When any new object is created (in all previous tool modes), assign a `uuid` as a custom `id` property so notes can reference it even after JSON serialise/restore:

```ts
import { v4 as uuidv4 } from 'uuid'; // npm install uuid @types/uuid
```

After each object is created, set:
```ts
obj.set('id', uuidv4());
// Also tell Fabric to include custom properties in toJSON:
// Pass to canvas constructor or call:
canvas.toJSON(['id']); // always pass ['id'] when serialising
```

> **Important:** Always call `canvas.toJSON(['id'])` (not just `canvas.toJSON()`) to ensure custom `id` properties are included in `canvas_json`. Update the save call in slice 4 accordingly:
> ```ts
> const json = fabricRef.current!.toJSON(['id']);
> ```

### `components/NotesSidePanel.tsx`
```tsx
'use client';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Note } from '@/types';

interface Props {
  setId: string;
  pageNum: number;
  selectedObjectId: string | null; // ID of the currently selected Fabric object
  onClose: () => void;
}

export default function NotesSidePanel({ setId, pageNum, selectedObjectId, onClose }: Props) {
  const supabase = createClient();
  const [notes, setNotes] = useState<Note[]>([]);
  const [draftBody, setDraftBody] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchNotes() {
      const { data } = await supabase
        .from('notes')
        .select('*')
        .eq('set_id', setId)
        .eq('page_number', pageNum)
        .order('created_at', { ascending: true });
      setNotes(data ?? []);
    }
    fetchNotes();
  }, [setId, pageNum]);

  async function addNote() {
    if (!selectedObjectId || !draftBody.trim()) return;
    const { data, error } = await supabase
      .from('notes')
      .upsert(
        { set_id: setId, page_number: pageNum, fabric_object_id: selectedObjectId, body: draftBody.trim(), updated_at: new Date().toISOString() },
        { onConflict: 'set_id,page_number,fabric_object_id' }
      )
      .select()
      .single();
    if (!error && data) {
      setNotes(prev => {
        const exists = prev.find(n => n.fabric_object_id === selectedObjectId);
        return exists ? prev.map(n => n.fabric_object_id === selectedObjectId ? data : n) : [...prev, data];
      });
      setDraftBody('');
    }
  }

  async function deleteNote(id: string) {
    await supabase.from('notes').delete().eq('id', id);
    setNotes(prev => prev.filter(n => n.id !== id));
  }

  return (
    <aside className="w-72 bg-stone-900 text-white flex flex-col h-full p-4 gap-4 overflow-y-auto">
      <div className="flex justify-between items-center">
        <h2 className="font-semibold">Notes — Page {pageNum}</h2>
        <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
      </div>

      {/* Add note for selected object */}
      {selectedObjectId && (
        <div className="flex flex-col gap-2 border border-stone-600 rounded p-3">
          <p className="text-xs text-gray-400">Note for selected annotation:</p>
          <textarea
            value={draftBody}
            onChange={e => setDraftBody(e.target.value)}
            placeholder="Type your note..."
            className="bg-stone-800 rounded p-2 text-sm resize-none h-20"
          />
          <button onClick={addNote} className="bg-emerald-700 text-white rounded px-3 py-1 text-sm self-end">
            Save note
          </button>
        </div>
      )}

      {/* All notes on this page */}
      <div className="flex flex-col gap-3">
        {notes.length === 0 && <p className="text-gray-500 text-sm">No notes on this page yet.</p>}
        {notes.map(note => (
          <div key={note.id} className="bg-stone-800 rounded p-3 text-sm flex flex-col gap-1">
            <p>{note.body}</p>
            <div className="flex justify-end gap-2 text-xs text-gray-400">
              <button onClick={() => deleteNote(note.id)} className="hover:text-red-400">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}
```

### Wire into `AnnotationCanvas.tsx`

Add state:
```ts
const [showNotes, setShowNotes] = useState(false);
const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
```

After canvas initialises, track object selection:
```ts
canvas.on('selection:created', (opt) => {
  const obj = opt.selected?.[0];
  setSelectedObjectId(obj?.get('id') as string ?? null);
});
canvas.on('selection:updated', (opt) => {
  const obj = opt.selected?.[0];
  setSelectedObjectId(obj?.get('id') as string ?? null);
});
canvas.on('selection:cleared', () => setSelectedObjectId(null));
```

Add "Notes" button to toolbar:
```tsx
<button
  onClick={() => setShowNotes(v => !v)}
  className="px-3 py-1 rounded text-sm bg-stone-700 text-white"
>
  📝 Notes {showNotes ? '▾' : '▸'}
</button>
```

Wrap the reader layout in a flex row to accommodate the side panel:
```tsx
<div className="flex">
  <div className="flex-1">
    {/* canvas */}
  </div>
  {showNotes && selectedSetId && (
    <NotesSidePanel
      setId={selectedSetId}
      pageNum={pageNum}
      selectedObjectId={selectedObjectId}
      onClose={() => setShowNotes(false)}
    />
  )}
</div>
```

---

## Done When
A user can select an annotation object, open the notes panel, type and save a note attached to that object, and see all notes for the page listed in the panel. Notes persist across reloads.
