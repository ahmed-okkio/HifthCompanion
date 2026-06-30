'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { Recurrence, Session } from '@/types';

/** Sessions for a halaqah, soonest first within the window we care about. */
export async function getSessions(halaqahId: string): Promise<Session[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session')
    .select('*')
    .eq('halaqah_id', halaqahId)
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Persist a halaqah's weekly recurrence rule (M3-1). */
export async function setSchedule(
  halaqahId: string,
  schedule: Recurrence | null,
): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('halaqah')
    .update({ schedule })
    .eq('id', halaqahId);
  if (error) throw error;
}

/**
 * Materialize one virtual recurring slot into a real session row (M3-1).
 * Idempotent: returns the existing row at that instant if present, else inserts.
 * Recurring sessions are virtual (computed from halaqah.schedule) until an
 * action — attendance or cancel — needs a row to hang off.
 * ponytail: race window between the existence check and insert; add a
 * unique(halaqah_id, scheduled_at) constraint if duplicate rows ever appear.
 */
export async function materializeSession(
  halaqahId: string,
  scheduledAt: string,
): Promise<Session> {
  const supabase = await createClientAction();
  const { data: existing } = await supabase
    .from('session')
    .select('*')
    .eq('halaqah_id', halaqahId)
    .eq('scheduled_at', scheduledAt)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('session')
    .insert({ halaqah_id: halaqahId, scheduled_at: scheduledAt })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Teacher adds an ad-hoc session (M3-2). */
export async function createAdhocSession(
  halaqahId: string,
  scheduledAt: string,
): Promise<Session> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('session')
    .insert({ halaqah_id: halaqahId, scheduled_at: scheduledAt, is_adhoc: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Teacher cancels / reinstates a session (M3-2). */
export async function setSessionCanceled(
  id: string,
  canceled: boolean,
): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('session')
    .update({ canceled })
    .eq('id', id);
  if (error) throw error;
}
