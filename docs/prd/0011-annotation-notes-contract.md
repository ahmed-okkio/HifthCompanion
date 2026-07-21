# Acceptance contract — 0011 Notes tied to annotations

> **This file is the acceptance criteria. It was written before the code.**
> **Do not edit this contract to make a test pass.** If an item is wrong or impossible, stop and
> raise it with the author — changing the contract to match the implementation defeats its purpose.
> A validator reports PASS / FAIL / BLOCKED per ID. Items marked **[SEC]** block the milestone on FAIL.

## A — Data & access

- **A1** A note may reference exactly one annotation object via `notes.fabric_object_id`, or none (unbound).
- **A2** Multiple notes may reference the same `fabric_object_id`. No unique constraint prevents it.
- **A3** `notes.author_id` is populated with the writing user on insert and is not settable by the client. **[SEC]**
- **A4** No RLS policy is added, dropped, or widened by this milestone. The set of principals who can read or write any `notes` row is identical before and after. **[SEC]**
- **A5** A teacher with an active circle membership can read and write notes on a student's default set, bound or unbound, exactly as before. **[SEC]**
- **A6** A set collaborator can read and write bound notes in the shared set. **[SEC]**
- **A7** A user with no relationship to a set cannot read its notes, bound or unbound. **[SEC]**
- **A8** `getNotes` never returns a soft-deleted note (`deleted_at is not null`).

## B — Object identity

- **B1** An annotation object receives a stable `id` only when a note is first bound to it. Objects with no note have no `id`.
- **B2** An object's `id` survives a save/reload round-trip through `annotations.canvas_json`.
- **B3** An object's `id` survives an undo and a redo.
- **B4** Existing canvases saved before this feature load without error and without gaining ids.
- **B5** Two objects never share an `id` within a page.

## C — Badge rendering

- **C1** An annotation with at least one non-deleted bound note displays a badge; one with none displays no badge.
- **C2** The badge is positioned over its annotation and remains positioned over it after the object is moved, resized, or the canvas is zoomed or panned.
- **C3** Badges are numbered in a stable order within a page; the same page renders the same numbering across reloads.
- **C4** A badge on an object with more than one note indicates the count.
- **C5** No badge is ever present in saved `canvas_json.objects`. **[SEC]**
- **C6** The per-page annotation count used by the Marked tab (PRD 0009) is unchanged by the presence of notes or badges — binding a note to an object does not alter the page's count.
- **C7** The eraser cannot delete a badge, and the badge is not selectable or draggable as a canvas object.
- **C8** Badges are reachable and activatable by keyboard, and carry an accessible label.

## D — Attach & navigate

- **D1** The `note` tool appears in both the desktop toolbar and the mobile bar, with a localized label.
- **D2** With the `note` tool active, clicking an annotation opens a note composer bound to that object.
- **D3** With the `note` tool active, clicking empty page area creates an unbound page-level note (pre-existing behavior preserved).
- **D4** Activating a badge highlights that object's note(s) in the notes panel and brings them into view.
- **D5** Selecting a bound note in the panel visibly flashes its badge on the canvas.
- **D6** A bound note displays its author; an unbound legacy note with no author renders without error.
- **D7** Selecting the `note` tool does not enter free-draw mode and produces no ink on click.

## E — Erase, undo, restore

- **E1** Erasing an annotation removes its notes from the panel.
- **E2** Erasing an annotation does not hard-delete its note rows; they are marked `deleted_at`.
- **E3** Undoing that erase restores the annotation, its badge, and its notes to the panel.
- **E4** Clearing a whole page soft-deletes all bound notes on it; undo restores them.
- **E5** A note whose object is gone and whose erase is not undone stays out of the panel permanently and is never resurrected by an unrelated save.
- **E6** Unbound notes are never affected by erasing or clearing annotations.

## F — Share & read-only

- **F1** The read-only share canvas renders badges for bound notes.
- **F2** Activating a badge on the share view brings the corresponding note into view in the read-only panel.
- **F3** A guest cannot create, edit, or delete notes from the share view. **[SEC]**
- **F4** The collaborator share branch renders badges and permits editing, consistent with the reader.
- **F5** The share view exposes no note data that it did not expose before this milestone. **[SEC]**

## G — Documented limits

- **G1** Soft-deleted note rows are not purged. This is deliberate (PRD D12) and must be marked with a `ponytail:` comment naming the upgrade path.
- **G2** Badge numbering is derived at render time, not persisted; numbering may shift if notes are deleted.
- **G3** Notes remain page-scoped for retrieval; there is no cross-page or set-wide note view.

## Validator output format

```
ID    VERDICT   EVIDENCE
A1    PASS      <file:line or test name proving it>
A4    FAIL      <what was observed instead>
C5    BLOCKED   <why it could not be checked>
```

Report every ID. Any **[SEC]** item at FAIL blocks the milestone regardless of the rest.
Any non-SEC FAIL is reported and triaged, not silently accepted.
