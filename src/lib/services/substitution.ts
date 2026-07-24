'use server';

import { createClientAction } from '@/lib/supabase/server';
import { notifySubstitution, type SubAssignment } from '@/lib/email/notify';
import { getCircleMembersWithProfiles } from '@/lib/services/membership';
import { getSessionsForMemberships } from '@/lib/services/sessions';
import { getProfilesByIds } from '@/lib/services/profile';
import { sectionSessions, floatingNow } from '@/lib/recurrence';
import { displayName } from '@/lib/displayName';
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

/** One assignable instant in the Manage-sessions list (mirrors AgendaItem). */
export interface ManageSlot {
  key: string;
  membershipId: string;
  sessionId: string | null;
  scheduled_at: string;
  isAdhoc: boolean;
  canceled: boolean;
  movedFrom: string | null;
  student: string;
  substituteName: string | null;
}

/**
 * Every upcoming instant across the circle's active students out to
 * `horizonDays` — unlike the dashboard agenda (one next slot per student) this
 * is the full expansion, so the Manage-sessions tab can page forward simply by
 * asking for a bigger horizon. Slots are virtual until someone touches them, so
 * there is nothing to paginate server-side: the recurrence rule IS the source.
 */
export async function getManageSlots(circleId: string, horizonDays: number): Promise<ManageSlot[]> {
  const active = (await getCircleMembersWithProfiles(circleId))
    .filter((m) => m.role === 'student' && m.status === 'active');
  if (active.length === 0) return [];

  const nowDate = floatingNow();
  const now = nowDate.getTime();
  const sessions = await getSessionsForMemberships(active.map((m) => m.id));
  const subs = await listSubstitutions(active.map((m) => m.id));
  const subProfiles = await getProfilesByIds(subs.map((s) => s.substitute_user_id));
  const subKey = (mid: string, at: string) => `${mid}|${new Date(at).getTime()}`;
  const subByInstant = new Map(
    subs.map((s) => {
      const p = subProfiles.get(s.substitute_user_id);
      return [
        subKey(s.membership_id, s.scheduled_at),
        displayName({ user_id: s.substitute_user_id, first_name: p?.first_name, last_name: p?.last_name }),
      ] as const;
    }),
  );

  return active
    .flatMap((m) => {
      const rows = sessions.filter((s) => s.membership_id === m.id);
      const { next, upcoming } = sectionSessions(m.schedule, rows, nowDate, horizonDays);
      return [...(next ? [next] : []), ...upcoming]
        .filter((slot) => new Date(slot.scheduled_at).getTime() >= now)
        .map((slot) => ({
          key: slot.session?.id ?? `${m.id}-${slot.scheduled_at}`,
          membershipId: m.id,
          sessionId: slot.session?.id ?? null,
          scheduled_at: slot.scheduled_at,
          isAdhoc: slot.session?.is_adhoc ?? false,
          canceled: slot.session?.canceled ?? false,
          movedFrom: slot.session?.moved_from ?? null,
          student: displayName(m),
          substituteName: subByInstant.get(subKey(m.id, slot.scheduled_at)) ?? null,
        }));
    })
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
}

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
  await notifySubstitution(affected);
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
  if (removed.length > 0) await notifySubstitution([], removed);
}

/**
 * Read substitution rows for the given memberships (F5 covered-by on load).
 * RLS scopes the result: a teacher sees rows for their circle's memberships, a
 * student sees rows for their own membership. Additive read — no write.
 */
export async function listSubstitutions(
  membershipIds: string[],
): Promise<SubRow[]> {
  if (membershipIds.length === 0) return [];
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('substitution')
    .select('membership_id, scheduled_at, substitute_user_id')
    .in('membership_id', membershipIds);
  if (error) throw error;
  return data ?? [];
}

/**
 * The caller's own active coverage for ONE membership (G2 scoped page). Same
 * RPC, same active-only guarantee — empty means no active coverage.
 */
export async function getCoveringFor(membershipId: string): Promise<CoveringSession[]> {
  return (await getCovering()).filter((r) => r.membership_id === membershipId);
}

/** The caller's own active coverage (G3) — feeds the UI Covering section. */
export async function getCovering(): Promise<CoveringSession[]> {
  const supabase = await createClientAction();
  const { data, error } = await supabase.rpc('covering_sessions');
  if (error) throw error;
  return data ?? [];
}
