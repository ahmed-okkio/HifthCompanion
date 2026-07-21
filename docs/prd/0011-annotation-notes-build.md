# Build manifest — 0011 Notes tied to annotations

- PRD: `0011-annotation-notes.md`
- Contract: `0011-annotation-notes-contract.md` (source of truth for done)

Workers run serially. Each milestone is one worker slice. A fresh-context validator is handed
**only the contract** and reports per-ID verdicts.

---

## M1 — Schema & service layer

**Goal.** `notes` gains binding, authorship, and soft-delete; the service layer honors them.

**Files.** `supabase/migrations/<ts>_annotation_notes.sql`, `src/lib/services/notes.ts`, `src/types/index.ts`

**Work.**
- `alter table public.notes add column fabric_object_id text, add column author_id uuid references auth.users(id) default auth.uid(), add column deleted_at timestamptz;`
- `create index notes_object_idx on public.notes (set_id, page_number, fabric_object_id);`
- `getNotes` filters `deleted_at is null`; `createNote` accepts an optional `fabricObjectId`.
- `Note` type gains the three fields.

**Constraints.**
- **Add no RLS policy. Drop none. Alter none.** Existing policies already cover the new columns.
- `author_id` comes from the column default only — never from client input.
- Leave the existing `x, y` columns and their `createNote` params alone; unused, out of scope.

**Contract IDs.** A1, A2, A3, A4, A5, A6, A7, A8

---

## M2 — Stable object ids

**Goal.** Fabric objects can carry an `id` that survives save, reload, undo, and redo.

**Files.** `src/hooks/canvas/useCanvasPersistence.ts`, `src/lib/canvasHistory.ts`, `src/hooks/useAnnotationCanvas.ts`

**Work.**
- `canvas.toJSON(['id'])` at `useCanvasPersistence.ts:114` **and** `canvasHistory.ts:15`. Both, or undo strips ids.
- Helper to stamp a uuid on an object that has none, called only from the note-bind path (M3).

**Constraints.**
- Do not stamp ids on `object:added`. Lazy only (PRD D4).
- Do not touch `pruneDegenerate` or `clusterCount` — count behavior must not move (C6).
- Verify B4 against a canvas blob saved without ids.

**Contract IDs.** B1, B2, B3, B4, B5

---

## M3 — Note tool & binding

**Goal.** A user can attach a note to an annotation.

**Files.** `src/lib/canvasTools.tsx`, `src/lib/i18n/dictionaries.ts`, `src/hooks/canvas/useCanvasTools.ts`, `src/components/NoteForm.tsx`, `src/components/NotesPanel.tsx`

**Work.**
- Add `'note'` to `Tool` and `ALL_TOOLS`, an icon to `TOOL_ICONS`, and a `tool.note` dictionary key.
- Mouse:down branch alongside the `text` case at `useCanvasTools.ts:229-230`: hit-test the click; object hit → stamp id if needed, open composer bound to it; empty area → unbound note as today.
- `NoteForm` carries `fabricObjectId` through to `createNote`.

**Constraints.**
- Both toolbars iterate `ALL_TOOLS` — do **not** edit `AnnotationToolbar.tsx` or `MobileAnnotationBar.tsx`.
- `note` must not enable `isDrawingMode` (`useAnnotationCanvas.ts:121`).

**Contract IDs.** D1, D2, D3, D6, D7

---

## M4 — Badge overlay

**Goal.** Bound annotations show a numbered badge that tracks the object.

**Files.** new `src/components/NoteBadgeLayer.tsx`, `src/components/AnnotationCanvas.tsx`

**Work.**
- DOM overlay, absolutely positioned, one badge per object id present in the page's notes; position from `obj.getBoundingRect()`.
- Recompute on `object:modified`, `after:render`, and viewport zoom/pan.
- Numbering by stable order within the page; count suffix when >1 note.
- Button semantics: focusable, labelled, keyboard-activatable.

**Constraints.**
- **Never** add a Fabric object for a badge, and never include badge state in anything reaching `canvas.toJSON()` (C5).
- Tap target ≥24px for mobile.

**Contract IDs.** C1, C2, C3, C4, C5, C6, C7, C8

---

## M5 — Bidirectional navigation

**Goal.** Badge ↔ panel navigation in both directions.

**Files.** `src/components/NotesPanel.tsx`, `src/components/NoteItem.tsx`, `src/components/SpreadNotesPanel.tsx`, `src/components/NoteBadgeLayer.tsx`

**Work.** Badge activate → scroll panel to and highlight that object's notes. Note select → pulse its badge. Author line on `NoteItem`.

**Constraints.** Spread view has two canvases — a badge must address the correct page's panel.

**Contract IDs.** D4, D5

---

## M6 — Soft-delete reconcile

**Goal.** Erasing cascades softly; undo restores.

**Files.** `src/hooks/canvas/useCanvasPersistence.ts`, `src/lib/services/notes.ts`

**Work.**
- In the save path, diff bound ids against `payload.objects`: absent → set `deleted_at`; present with `deleted_at` set → clear it.
- `handleClear` (`useCanvasPersistence.ts:288`) routes through the same reconcile, batched.
- `ponytail:` comment on the no-purge decision naming the upgrade path (G1).

**Constraints.**
- Never hard-delete a note as a side effect of a canvas operation.
- Unbound notes must be untouched by the diff (E6).
- Reconcile must be scoped to the saved page — never resurrect or delete notes on other pages (E5).

**Contract IDs.** E1, E2, E3, E4, E5, E6, G1

---

## M7 — Share & read-only

**Goal.** Badges on the guest and collaborator share views.

**Files.** `src/components/ReadOnlyCanvas.tsx`, `src/app/share/[setId]/[page]/page.tsx`

**Work.** Mount `NoteBadgeLayer` over `ReadOnlyCanvas`, fed by the notes already fetched at `page.tsx:90`. Badge activate scrolls the `readOnly` panel.

**Constraints.**
- No new fetch and no new RLS. The guest branch already has the notes.
- Guests get no create/edit/delete affordance (F3).

**Contract IDs.** F1, F2, F3, F4, F5, G2, G3

---

## Security-critical (block on FAIL)

A3, A4, A5, A6, A7, C5, F3, F5.

## Definition of done

Every contract ID PASS from a fresh-context validator handed only
`0011-annotation-notes-contract.md`. Coverage check: A1–A8, B1–B5, C1–C8, D1–D7, E1–E6, F1–F5,
G1–G3 — each claimed by exactly one milestone, no orphans.
