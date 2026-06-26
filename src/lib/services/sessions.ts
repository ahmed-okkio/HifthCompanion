'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { Recurrence, Session } from '@/types';
import { missingSlots } from '@/lib/recurrence';

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
 * Materialize missing recurring sessions over the horizon (M3-1). Idempotent:
 * only inserts slots not already present. Returns the freshly inserted rows.
 */
export async function generateSessions(
  halaqahId: string,
  schedule: Recurrence | null,
  existing: Session[],
  horizonDays = 28,
): Promise<Session[]> {
  const slots = missingSlots(
    schedule,
    existing.map((s) => s.scheduled_at),
    new Date(),
    horizonDays,
  );
  if (slots.length === 0) return [];

  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('session')
    .insert(slots.map((scheduled_at) => ({ halaqah_id: halaqahId, scheduled_at })))
    .select();
  if (error) throw error;
  return data ?? [];
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
