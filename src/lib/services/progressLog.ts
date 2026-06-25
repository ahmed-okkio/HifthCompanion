'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { ProgressLog } from '@/types';

export type NewProgressLog = {
  membership_id: string;
  log_date?: string;
  log_type: string;
  page_start: number;
  page_end: number;
  surah?: number | null;
  ayah_start?: number | null;
  ayah_end?: number | null;
  student_status?: string | null;
  student_notes?: string | null;
};

/** Logs for one membership (student timeline / teacher profile view). */
export async function getLogsForMembership(
  membershipId: string,
): Promise<ProgressLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('progress_log')
    .select('*')
    .eq('membership_id', membershipId)
    .order('log_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** Today's submissions across a set of memberships (teacher daily feed). */
export async function getLogsForMemberships(
  membershipIds: string[],
  logDate?: string,
): Promise<ProgressLog[]> {
  if (membershipIds.length === 0) return [];
  const supabase = await createClient();
  let query = supabase
    .from('progress_log')
    .select('*')
    .in('membership_id', membershipIds)
    .order('created_at', { ascending: false });
  if (logDate) query = query.eq('log_date', logDate);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function createLog(log: NewProgressLog): Promise<ProgressLog> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('progress_log')
    .insert(log)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Student edits own log (blocked by RLS once reviewed). */
export async function updateLog(
  id: string,
  patch: Partial<NewProgressLog>,
): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('progress_log')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteLog(id: string): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase.from('progress_log').delete().eq('id', id);
  if (error) throw error;
}

/** Teacher grade + check-off (M1-9). Stamps reviewed_at, which locks the log. */
export async function gradeLog(
  id: string,
  grade: { teacher_status?: string | null; teacher_comment?: string | null },
): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('progress_log')
    .update({ ...grade, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}
