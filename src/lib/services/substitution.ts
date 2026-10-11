'use server';

import { createClientAction } from '@/lib/supabase/server';
import { after } from 'next/server';
import * as reads from '@/lib/tracker/reads';

import { notifySubstitution, type SubAssignment } from '@/lib/email/notify';
import type { StatusConfig } from '@/types';

/** Selected columns off the new substitution table (not yet in generated types). */
interface SubRow {
  membership_id: string;
  scheduled_at: string;
  substitute_user_id: string;
}

/** A row of the covering_sessions() RPC — the sub's own active coverage (G3). */
export interface CoveringSession {
  membership_id: string;
  scheduled_at: string;
  /** G2: deep-link target — a sub cannot read membership/circle to derive it. */
  circle_id: string;
  student_name: string;
  circle_name: string;
  teacher_name: string;
  /** C4: the circle's grade labels — a sub cannot read `circle` to get them. */
  teacher_statuses: StatusConfig[];
  /** Homework marking: the student-status chips on the result form. */
  student_statuses: StatusConfig[];
  /** C5: the covered student's default annotation set (null if they have none). */
  default_set_id: string | null;
  /** E5: the away teacher's id — so their marks attribute to them, not "· sub". */
  teacher_id: string;
}

// F2 (sub must be an existing account) is enforced by the picker: it only ever
// hands back an id from `accounts_by_email_prefix`, so a typed-but-unknown email
// can't be submitted at all. See SubAssignForm.

/**
 * Upsert one substitution row per instant (A2). ON CONFLICT (membership_id,
 * scheduled_at) replaces the substitute. `created_by` is server-stamped by the
 * DB insert guard — never sent from here. Returns the affected rows, then fires
 * the best-effort notify (H4: a failed email must not roll back the write).
 */
export async function assignSubstitutes(
  rows: { membershipId: string; scheduledAt: string; substituteUserId: string }[],
): Promise<SubAssignment[]> {
  if (rows.length === 0) return [];
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('substitution')
    .upsert(
      rows.map((r) => ({
        membership_id: r.membershipId,
        scheduled_at: r.scheduledAt,
        substitute_user_id: r.substituteUserId,
      })),
      { onConflict: 'membership_id,scheduled_at' },
    )
    .select('membership_id, scheduled_at, substitute_user_id');
  if (error) throw error;

  const affected: SubAssignment[] = (data ?? []).map((d: SubRow) => ({
    membershipId: d.membership_id,
    scheduledAt: d.scheduled_at,
    substituteUserId: d.substitute_user_id,
  }));
  const actor = (await supabase.auth.getUser()).data.user?.id ?? null;
  after(() => notifySubstitution(affected, [], actor));
  return affected;
}

/**
 * Reclaim exactly one instant (F4/A5 — reclaim is a plain delete). Then notify
 * the sub and the student that coverage is off (H3), best-effort.
 */
export async function removeSubstitution(
  membershipId: string,
  scheduledAt: string,
): Promise<void> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('substitution')
    .delete()
    .eq('membership_id', membershipId)
    .eq('scheduled_at', scheduledAt)
    .select('membership_id, scheduled_at, substitute_user_id');
  if (error) throw error;

  const removed: SubAssignment[] = (data ?? []).map((d: SubRow) => ({
    membershipId: d.membership_id,
    scheduledAt: d.scheduled_at,
    substituteUserId: d.substitute_user_id,
  }));
  const actor = (await supabase.auth.getUser()).data.user?.id ?? null;
  if (removed.length > 0) after(() => notifySubstitution([], removed, actor));
}

/**
 * Read substitution rows for the given memberships (F5 covered-by on load).
 * RLS scopes the result: a teacher sees rows for their circle's memberships, a
 * student sees rows for their own membership. Additive read — no write.
 */
export async function listSubstitutions(
  membershipIds: string[],
): Promise<SubRow[]> {
  return reads.listSubstitutions(await createClientAction(), membershipIds);
}

/** The caller's own active coverage (G3) — feeds the UI Covering section. */
export async function getCovering(): Promise<CoveringSession[]> {
  return reads.getCovering(await createClientAction());
}
