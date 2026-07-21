# PRD 0011 — Notes tied to annotations (grill-with-docs output)

> A note can be attached to a specific annotation object on the page. Annotations that carry notes
> show a small numbered footnote badge; tapping it highlights the note in the notes panel, and
> tapping a note flashes its badge. The acceptance contract
> (`0011-annotation-notes-contract.md`) is the source of truth for "done".

## Problem / Goal

- `notes` is **page-scoped only** (`supabase/migrations/20260620000001_create_notes_table.sql:2-11`
  — `set_id, page_number, body, x, y`). A page can hold many annotations and many notes, with no
  link between them. The reader cannot tell which mark a note is about.
- `NotesPanel.tsx` renders a flat list per page with no canvas relationship.
- The `x, y` columns exist and `createNote` still accepts and persists them
  (`src/lib/services/notes.ts:22-29`), but no caller passes them — a stalled earlier attempt at
  pin-style notes. This PRD does not revive them; anchoring is by object id, not coordinates.
- `story-guidance/slice-08-notes.md` already proposed a `fabric_object_id` scheme that was never
  shipped. This PRD resurrects it rather than inventing a new mechanism.

Goal: let a user attach a note to a chosen annotation, make "this annotation has notes" visible on
the page at a glance, and make the badge↔panel relationship navigable in both directions.

## Principles

- **Footnote, not pin.** The indicator is a small numbered chip anchored to the annotated object,
  the familiar scripture-footnote convention. Rejected: object glow (low contrast over colored
  ink, muddy when annotations cluster) and margin gutter markers (coordinate snapshot drifts on
  rescale).
- **The badge is chrome, not ink.** It renders as a DOM overlay, never as a Fabric object, so it
  can never enter `canvas_json`, never be erased, and never pollute annotation counts.
- **Lazy identity.** Fabric objects get a stable `id` only when a note is first attached. No blob
  migration, existing canvases untouched.
- **Erasing ink is reversible.** Cascade deletes are soft, and undo restores both the annotation
  and its notes.
- **No new RLS.** Notes already carry teacher, collaborator, and share-link read/write policies.
  This feature adds no access surface.

## Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Indicator is a **numbered footnote badge** at the annotated object's corner | Reads on any ink color (neutral chip, not color-dependent); familiar in a scripture context; low clutter over sacred text; supports bidirectional badge↔panel affordance that glow/gutter designs don't |
| D2 | Badge renders as a **DOM overlay**, positioned from `obj.getBoundingRect()` | A Fabric badge would serialize into `canvas_json` and be counted by `clusterCount` (`useCanvasPersistence.ts:120`), inflating the PRD 0009 Marked-tab counts, and would be erasable/draggable as if it were ink. DOM also gives free hover/tap targets and a11y |
| D3 | Attachment via a **new `note` tool** (7th entry in `Tool`) | `canvasTools.tsx:3` has no select tool; `useCanvasTools.ts:229-230` already has a mouse:down branch where the `text` tool spawns on click — exact precedent. Same interaction on mobile, no new gesture competing with pan |
| D4 | Fabric objects get a stable `id` **lazily, on first note bind** | Existing saved canvases untouched, no blob migration, no bytes added for objects that never get a note |
| D5 | `canvas.toJSON(['id'])` in **both** `useCanvasPersistence.ts:114` **and** `canvasHistory.ts:15` | The history snapshot uses a plain `toJSON()`; missing the allowlist there would silently strip ids on undo and orphan every note |
| D6 | **Many notes per annotation**, one badge showing count when >1 | No unique constraint. Teacher/student threading on a single annotation falls out free, made readable by D7 |
| D7 | Add **`notes.author_id`** (default `auth.uid()`) | Teachers and collaborators already write notes; with threading (D6) unattributed notes get confusing fast |
| D8 | **No RLS change** | Verified: teacher policies (`20260701000004_circle_rls.sql:110-134`), collaborator policies (`20260628000002_set_collaborators.sql:79-95`). Notes are already readable/writable by exactly the right parties |
| D9 | **Badges render on the read-only share canvas**, tap scrolls the panel | Guests already read every note on a shared set (`share/[setId]/[page]/page.tsx:119-124` renders `NotesPanel readOnly` from `getNotes` at line 90). There is no privacy to protect, and hiding badges would leave the guest view strictly less coherent than its own panel |
| D10 | Erasing an annotation **cascades to its notes, softly** (`deleted_at`) | Note disappears from the panel with the annotation, as expected; but the row survives so undo can restore it |
| D11 | Undo restores notes: on save, **clear `deleted_at`** for any note whose `id` is back in `payload.objects` | `CanvasHistory` (`canvasHistory.ts:4-19`) restores serialized props, so an undone object returns with the same `id` — the binding survives for free. Only the DB row needed rescuing |
| D12 | **No purge job.** Soft-deleted rows filtered on read | YAGNI; add a purge when the table's size actually matters. Marked with a `ponytail:` comment |

## Flow resolution

**Attach.** Select `note` tool → click an annotation → if the object has no `id`, stamp a uuid and
mark the canvas dirty; open `NoteForm` bound to that `fabric_object_id`. Clicking empty page area
with the note tool active creates an unbound page-level note (today's behavior, preserved).

**Read.** On canvas render and on `object:modified` / zoom / pan, recompute badge positions from
`getBoundingRect()` for every object whose `id` appears in the page's notes. Badge shows the
footnote index (creation order among bound notes on that page, computed client-side, not stored);
count suffix when the object has >1 note.

**Navigate.** Tap badge → panel scrolls to and highlights those notes. Tap/hover a bound note →
its badge pulses. Unbound notes render in the panel as today with no badge.

**Erase.** On save, any bound `fabric_object_id` no longer present in `payload.objects` gets
`deleted_at = now()`; any present again gets `deleted_at = null`. Page clear is the same operation,
batched.

## Scope

- Migration: `notes` gains `fabric_object_id text`, `author_id uuid`, `deleted_at timestamptz`; index on `(set_id, page_number, fabric_object_id)`.
- `toJSON(['id'])` in persistence + history; lazy uuid stamping.
- New `note` tool: add to `Tool` + `ALL_TOOLS` + `TOOL_ICONS` in `canvasTools.tsx`, add the
  `tool.note` dictionary key, add the mouse:down branch. Both toolbars iterate `ALL_TOOLS` and
  derive labels from `tool.${tool}` (`AnnotationToolbar.tsx:136`, `MobileAnnotationBar.tsx:53`),
  so neither component needs editing.
- `NoteBadgeLayer` DOM overlay component, used by `AnnotationCanvas` and `ReadOnlyCanvas`.
- `NotesPanel`/`NoteItem`: badge index, author display, highlight-on-select, bidirectional flash.
- Soft-delete reconcile in the save path; `deleted_at is null` filter in `getNotes`.

## Non-goals

- Ayah-level or word-level anchoring.
- Note replies as a distinct entity (threading is just multiple notes on one object).
- Purge/GC of soft-deleted rows (D12).
- Rich text, attachments, or mentions in notes.
- Exposing badges anywhere outside the reader and share canvas.

## Security notes

No new RLS policies, no new `security definer` functions, no widened access. `author_id` defaults
to `auth.uid()` and must not be client-settable on insert. The share-link surface gains no data it
did not already serve (D9).

## References

- Precedent for the id scheme: `story-guidance/slice-08-notes.md`
- Count pollution risk: `src/hooks/canvas/useCanvasPersistence.ts:120`, PRD 0009
- Tool click precedent: `src/hooks/canvas/useCanvasTools.ts:229-230`
- Contract: `0011-annotation-notes-contract.md`
