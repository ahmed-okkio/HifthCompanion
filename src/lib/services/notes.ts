'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { Note } from '@/types';
import { diffNoteBindings } from '@/lib/noteReconcile';

export async function getNotes(setId: string, pageNumber: number): Promise<Note[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('set_id', setId)
    .eq('page_number', pageNumber)
    .is('deleted_at', null)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createNote(
  setId: string,
  pageNumber: number,
  body: string,
  x?: number,
  y?: number,
  fabricObjectId?: string
): Promise<{ data: Note | null; error: string | null }> {
  try {
    const supabase = await createClientAction();
    const { data, error } = await supabase
      .from('notes')
      .insert({ set_id: setId, page_number: pageNumber, body: body.trim(), x: x ?? null, y: y ?? null, fabric_object_id: fabricObjectId ?? null })
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Failed to create note' };
  }
}

/**
 * Cascade a canvas save onto its page's bound notes: an object that vanished takes its notes
 * out of the panel, an undo that brings the object back brings them with it.
 * Scoped to one (set, page) — a save here can never touch another page's notes.
 *
 * ponytail: soft-delete only, rows are never purged (PRD D12). Undo restore needs the row to
 * still exist, so nothing here may hard-delete. Upgrade path when the table gets heavy: a
 * scheduled job (pg_cron) deleting `deleted_at < now() - interval '90 days'`, not a delete here.
 */
export async function reconcileNoteBindings(
  setId: string,
  pageNumber: number,
  presentObjectIds: string[]
): Promise<{ error: string | null }> {
  try {
    const supabase = await createClientAction();
    const { data, error } = await supabase
      .from('notes')
      .select('id, fabric_object_id, deleted_at')
      .eq('set_id', setId)
      .eq('page_number', pageNumber)
      .not('fabric_object_id', 'is', null);
    if (error) return { error: error.message };

    const { softDelete, restore } = diffNoteBindings(data ?? [], presentObjectIds);
    // Two batched updates at most — `handleClear` is just this with an empty present set.
    const writes = [];
    if (softDelete.length) {
      writes.push(supabase.from('notes').update({ deleted_at: new Date().toISOString() }).in('id', softDelete));
    }
    if (restore.length) {
      writes.push(supabase.from('notes').update({ deleted_at: null }).in('id', restore));
    }
    const results = await Promise.all(writes);
    const failed = results.find(r => r.error);
    return { error: failed?.error?.message ?? null };
  } catch (err: any) {
    return { error: err?.message || 'Failed to reconcile notes' };
  }
}

export async function updateNote(id: string, body: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createClientAction();
    const { error } = await supabase
      .from('notes')
      .update({ body: body.trim(), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err?.message || 'Failed to update note' };
  }
}

/** Link or unlink a note to a canvas object. Pass null to unlink. */
export async function linkNote(id: string, fabricObjectId: string | null): Promise<{ error: string | null }> {
  try {
    const supabase = await createClientAction();
    const { error } = await supabase
      .from('notes')
      .update({ fabric_object_id: fabricObjectId, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err?.message || 'Failed to link note' };
  }
}

export async function deleteNote(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = await createClientAction();
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);
    if (error) return { error: error.message };
    return { error: null };
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete note' };
  }
}
