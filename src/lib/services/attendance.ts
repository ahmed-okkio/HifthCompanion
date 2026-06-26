'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { Attendance, AttendanceStatus } from '@/types';

/** Attendance rows for a set of sessions (teacher roll / analytics). */
export async function getAttendanceForSessions(
  sessionIds: string[],
): Promise<Attendance[]> {
  if (sessionIds.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .in('session_id', sessionIds);

  if (error) throw error;
  return data ?? [];
}

/** Attendance rows for one membership (student profile analytics). */
export async function getAttendanceForMembership(
  membershipId: string,
): Promise<Attendance[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('membership_id', membershipId);

  if (error) throw error;
  return data ?? [];
}

/**
 * Mark one student's attendance for a session (M3-3). Upserts on the
 * (session_id, membership_id) unique key so re-marking updates in place.
 */
export async function markAttendance(
  sessionId: string,
  membershipId: string,
  status: AttendanceStatus,
): Promise<Attendance> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      {
        session_id: sessionId,
        membership_id: membershipId,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'session_id,membership_id' },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}
