/** Minimal shape the reconcile diff needs off a `notes` row. */
export type BoundNoteRow = { id: string; fabric_object_id?: string | null; deleted_at?: string | null };

/**
 * Diff the page's bound notes against the object ids still on the canvas.
 * - bound id gone from the canvas + not yet soft-deleted → soft-delete
 * - bound id back on the canvas (undo) + soft-deleted     → restore
 * Unbound notes (no `fabric_object_id`) are never touched.
 */
export function diffNoteBindings(rows: BoundNoteRow[], presentIds: Iterable<string>) {
  const present = new Set(presentIds);
  const softDelete: string[] = [];
  const restore: string[] = [];
  for (const r of rows) {
    if (!r.fabric_object_id) continue; // E6: unbound notes are not ours to touch
    const here = present.has(r.fabric_object_id);
    if (!here && !r.deleted_at) softDelete.push(r.id);
    else if (here && r.deleted_at) restore.push(r.id);
  }
  return { softDelete, restore };
}
