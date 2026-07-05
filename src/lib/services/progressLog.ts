'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { LogType, Polarity, ProgressLog, StatusConfig } from '@/types';
import { logToMemorizedRanges } from '@/lib/analytics';

export type NewProgressLog = {
  membership_id: string;
  // null = open self-submission; set = linked to a homework prescription (D6).
  homework_id?: string | null;
  log_date?: string;
  log_type: LogType;
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

  if (error) {
    // Deadline hard-lock (guard_homework_deadline trigger, D10) — surface cleanly.
    if (/past-deadline/i.test(error.message)) {
      throw new Error('This homework is past its deadline and can no longer be submitted.');
    }
    throw error;
  }
  return data;
}

/** Teacher logs a homework submission on the student's behalf AND reviews it in
 *  one shot: inserts the log with student fields + teacher grade + reviewed_at,
 *  then credits hifth like a normal grade. Teacher INSERT RLS + deadline exemption
 *  (migration 20260705000006) permit this. */
export async function logAndReview(input: NewProgressLog & {
  teacher_status?: string | null;
  teacher_comment?: string | null;
}): Promise<ProgressLog> {
  const supabase = await createClientAction();
  const { teacher_status, teacher_comment, ...log } = input;
  const { data, error } = await supabase
    .from('progress_log')
    .insert({
      ...log,
      log_date: log.log_date ?? new Date().toISOString().slice(0, 10),
      teacher_status: teacher_status ?? null,
      teacher_comment: teacher_comment ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .select()
    .single();
  if (error) throw error;

  if (teacher_status) {
    try {
      await creditHifthFromLog(supabase, data.id, teacher_status);
    } catch {
      /* non-fatal — the grade already landed */
    }
  }
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

  // Approving a memorization submission (positive-polarity status) folds the
  // log's ayah range into the student's persistent hifth profile. Best-effort:
  // a credit failure must not fail the grade itself.
  if (grade.teacher_status) {
    try {
      await creditHifthFromLog(supabase, id, grade.teacher_status);
    } catch {
      /* non-fatal — the grade already landed */
    }
  }
}

/** Credit a positively-graded memorization log into the student's user_hifth,
 *  via the teaches_user-guarded RPC. Resolves membership → student + circle
 *  polarity server-side so the client is never trusted for it. */
async function creditHifthFromLog(
  supabase: Awaited<ReturnType<typeof createClientAction>>,
  logId: string,
  status: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('progress_log')
    .select('log_type, page_start, page_end, surah, ayah_start, ayah_end, membership:membership_id(user_id, circle:circle_id(teacher_statuses))')
    .eq('id', logId)
    .single();
  if (error || !data) return;

  // supabase types the embedded relations as arrays; narrow to the single row.
  const membership = (Array.isArray(data.membership) ? data.membership[0] : data.membership) as
    | { user_id: string; circle: { teacher_statuses: StatusConfig[] } | { teacher_statuses: StatusConfig[] }[] }
    | null;
  if (data.log_type !== 'memorization' || !membership) return;

  const circle = Array.isArray(membership.circle) ? membership.circle[0] : membership.circle;
  const polarity: Polarity | undefined =
    circle?.teacher_statuses.find((s) => s.label === status)?.polarity;
  if (polarity !== 'positive') return;

  const ranges = logToMemorizedRanges(data);
  if (ranges.length === 0) return;
  await supabase.rpc('teacher_add_hifth', { _student: membership.user_id, _ranges: ranges });
}
