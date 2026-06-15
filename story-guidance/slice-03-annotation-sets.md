# Slice 3 — Annotation Sets (CRUD)

## Goal
Logged-in users can create, rename, and delete named annotation sets. These are the containers that hold a user's markings across pages.

---

## Database Migration

Run in Supabase SQL editor:

```sql
create table annotation_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- Row Level Security
alter table annotation_sets enable row level security;

create policy "Users can manage their own sets"
  on annotation_sets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

---

## Types: `types/index.ts`
```ts
export interface AnnotationSet {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}
```

---

## Implementation

### `app/sets/page.tsx` — server component, fetches sets
```tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import SetsList from '@/components/SetsList';

export default async function SetsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: sets } = await supabase
    .from('annotation_sets')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="max-w-lg mx-auto mt-10 px-4">
      <h1 className="text-2xl font-bold mb-6">My Annotation Sets</h1>
      <SetsList initialSets={sets ?? []} />
    </div>
  );
}
```

### `components/SetsList.tsx` — client component with CRUD
```tsx
'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AnnotationSet } from '@/types';

export default function SetsList({ initialSets }: { initialSets: AnnotationSet[] }) {
  const supabase = createClient();
  const [sets, setSets] = useState<AnnotationSet[]>(initialSets);
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function createSet() {
    if (!newName.trim()) return;
    const { data, error } = await supabase
      .from('annotation_sets')
      .insert({ name: newName.trim() })
      .select()
      .single();
    if (!error && data) {
      setSets([data, ...sets]);
      setNewName('');
    }
  }

  async function renameSet(id: string) {
    if (!editName.trim()) return;
    const { error } = await supabase
      .from('annotation_sets')
      .update({ name: editName.trim() })
      .eq('id', id);
    if (!error) {
      setSets(sets.map(s => s.id === id ? { ...s, name: editName.trim() } : s));
      setEditingId(null);
    }
  }

  async function deleteSet(id: string) {
    if (!confirm('Delete this set and all its annotations?')) return;
    const { error } = await supabase
      .from('annotation_sets')
      .delete()
      .eq('id', id);
    if (!error) setSets(sets.filter(s => s.id !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Create */}
      <div className="flex gap-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && createSet()}
          placeholder="New set name..."
          className="flex-1 border rounded px-3 py-2"
        />
        <button onClick={createSet} className="bg-emerald-700 text-white px-4 rounded">
          Create
        </button>
      </div>

      {/* List */}
      {sets.length === 0 && <p className="text-gray-400">No sets yet. Create one above.</p>}
      {sets.map(set => (
        <div key={set.id} className="flex items-center justify-between border rounded px-4 py-3">
          {editingId === set.id ? (
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') renameSet(set.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              className="flex-1 border rounded px-2 py-1 mr-2"
            />
          ) : (
            <span className="flex-1 font-medium">{set.name}</span>
          )}
          <div className="flex gap-2 text-sm">
            {editingId === set.id ? (
              <>
                <button onClick={() => renameSet(set.id)} className="text-emerald-600">Save</button>
                <button onClick={() => setEditingId(null)} className="text-gray-400">Cancel</button>
              </>
            ) : (
              <>
                <button
                  onClick={() => { setEditingId(set.id); setEditName(set.name); }}
                  className="text-blue-500"
                >
                  Rename
                </button>
                <button onClick={() => deleteSet(set.id)} className="text-red-400">Delete</button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## Nav Link
Add a link to `/sets` in your top nav (add to `ReaderNav` or a shared layout header):
```tsx
<a href="/sets" className="text-sm text-white underline">My Sets</a>
```

---

## Free-tier Checklist
- ✅ RLS ensures users only ever see/touch their own rows — no server-side auth checks needed in API routes
- ✅ All queries are simple indexed lookups by `user_id` — well within Supabase free tier DB limits (500MB)
- ✅ No Vercel serverless functions used — all Supabase client-side calls

## Done When
A logged-in user can visit `/sets`, create sets by name, rename them inline, and delete them with confirmation. Sets persist across page reloads.
