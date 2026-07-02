'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import { recurringSlots } from '@/lib/recurrence';
import type { AttendanceStatus, Recurrence, Session } from '@/types';

/** Sessions for one membership (a student's own 1:1 slot), soonest first. */
export async function getSessions(membershipId: string): Promise<Session[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session')
    .select('*')
    .eq('membership_id', membershipId)
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Sessions across many memberships (teacher aggregate agenda, D5). */
export async function getSessionsForMemberships(
  membershipIds: string[],
): Promise<Session[]> {
  if (membershipIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('session')
    .select('*')
    .in('membership_id', membershipIds)
    .order('scheduled_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Persist a student's per-membership weekly recurrence rule (D4). */
export async function setSchedule(
  membershipId: string,
  schedule: Recurrence | null,
): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('membership')
    .update({ schedule })
    .eq('id', membershipId);
  if (error) throw error;
}

/**
 * Materialize the missing recurring slots for a membership into real rows.
 * Idempotent via the (membership_id, scheduled_at) unique — ignoreDuplicates
 * skips slots that already exist. No-op when the membership has no schedule.
 */
export async function generateSessions(
  membershipId: string,
  schedule: Recurrence | null,
  from: Date = new Date(),
  horizonDays = 28,
): Promise<void> {
  const slots = recurringSlots(schedule, from, horizonDays);
  if (slots.length === 0) return;
  const supabase = await createClientAction();
  const rows = slots.map((s) => ({ membership_id: membershipId, scheduled_at: s }));
  const { error } = await supabase
    .from('session')
    .upsert(rows, { onConflict: 'membership_id,scheduled_at', ignoreDuplicates: true });
  if (error) throw error;
}

/**
 * Materialize one virtual recurring slot into a real session row.
 * Idempotent: returns the existing row at that instant if present, else inserts.
 */
export async function materializeSession(
  membershipId: string,
  scheduledAt: string,
): Promise<Session> {
  const supabase = await createClientAction();
  const { data: existing } = await supabase
    .from('session')
    .select('*')
    .eq('membership_id', membershipId)
    .eq('scheduled_at', scheduledAt)
    .maybeSingle();
  if (existing) return existing;

  const { data, error } = await supabase
    .from('session')
    .insert({ membership_id: membershipId, scheduled_at: scheduledAt })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Teacher adds an ad-hoc session for a membership. */
export async function createAdhocSession(
  membershipId: string,
  scheduledAt: string,
): Promise<Session> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('session')
    .insert({ membership_id: membershipId, scheduled_at: scheduledAt, is_adhoc: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Teacher cancels / reinstates a session. */
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

/** Mark (or clear) a session's attendance on the session row (D3). */
export async function setSessionAttendance(
  sessionId: string,
  status: AttendanceStatus | null,
): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('session')
    .update({ attendance_status: status })
    .eq('id', sessionId);
  if (error) throw error;
}
