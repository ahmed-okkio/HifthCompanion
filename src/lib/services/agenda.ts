'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import { normalizeBody, sectionAgenda, DONE_RETENTION_DAYS } from '@/lib/agenda';
import type { AgendaTask } from '@/types';

/**
 * A membership's agenda: all open items oldest-first, then items done within the
 * last 30 days newest-done-first (C1, C2). No membership filtering here — RLS
 * (B1) is the gate, so a caller who does not teach the membership gets nothing (C7).
 */
export async function listAgenda(membershipId: string): Promise<AgendaTask[]> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - DONE_RETENTION_DAYS * 24 * 60 * 60_000).toISOString();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('agenda_item')
    .select('*')
    .eq('membership_id', membershipId)
    .or(`done_at.is.null,done_at.gte.${cutoff}`);
  if (error) throw error;
  return sectionAgenda((data ?? []) as AgendaTask[], now);
}

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
