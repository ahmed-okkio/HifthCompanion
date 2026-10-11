'use server';

import { createClientAction } from '@/lib/supabase/server';
import { normalizeBody } from '@/lib/agenda';
import type { AgendaTask } from '@/types';

/** Add an item. Empty or whitespace-only bodies are rejected before any write (C3). */
export async function addItem(membershipId: string, body: string): Promise<AgendaTask> {
  const trimmed = normalizeBody(body);
  if (trimmed === null) throw new Error('Agenda item body is empty');
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('agenda_item')
    .insert({ membership_id: membershipId, body: trimmed })
    .select()
    .single();
  if (error) throw error;
  return data as AgendaTask;
}

/** Tick / untick an item. Idempotent, and the same operation as dismissing (C4, C5). */
export async function setDone(id: string, done: boolean): Promise<AgendaTask> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('agenda_item')
    .update({ done_at: done ? new Date().toISOString() : null })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as AgendaTask;
}

/** Edit an item's text. Touches `body` only; `updated_at` moves via trigger (C6). */
export async function updateBody(id: string, body: string): Promise<AgendaTask> {
  const trimmed = normalizeBody(body);
  if (trimmed === null) throw new Error('Agenda item body is empty');
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('agenda_item')
    .update({ body: trimmed })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as AgendaTask;
}
