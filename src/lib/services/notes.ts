'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { Note } from '@/types';

export async function getNotes(setId: string, pageNumber: number): Promise<Note[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('notes')
    .select('*')
    .eq('set_id', setId)
    .eq('page_number', pageNumber)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createNote(
  setId: string,
  pageNumber: number,
  body: string,
  x?: number,
  y?: number
): Promise<{ data: Note | null; error: string | null }> {
  try {
    const supabase = await createClientAction();
    const { data, error } = await supabase
      .from('notes')
      .insert({ set_id: setId, page_number: pageNumber, body: body.trim(), x: x ?? null, y: y ?? null })
      .select()
      .single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Failed to create note' };
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
