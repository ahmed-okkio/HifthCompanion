'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { Circle, Membership, MemberWithProfile } from '@/types';
import { getProfilesByIds } from '@/lib/services/profile';
import { after } from 'next/server';
import * as reads from '@/lib/tracker/reads';

import { notifyInvite } from '@/lib/email/notify';

export type MembershipWithCircle = Membership & { circle: Circle };

/** Circle roster enriched with each member's display name (when readable). */
export async function getCircleMembersWithProfiles(
  circleId: string,
): Promise<MemberWithProfile[]> {
  return reads.getCircleMembersWithProfiles(await createClient(), circleId);
}

export type RosterMember = {
  user_id: string;
  role: 'teacher' | 'student';
  first_name: string | null;
  last_name: string | null;
};

/** Join a circle by id as a student. Lands as 'pending' — consent gate (D12). */
export async function joinCircle(circleId: string): Promise<Membership> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('membership')
    .insert({ circle_id: circleId, role: 'student', status: 'pending' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * The invited user accepts their own pending membership (D12). The DB trigger
 * enforces self-only + the pending→active transition; the service just updates.
 */
export async function acceptMembership(membershipId: string): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('membership')
    .update({ status: 'active' })
    .eq('id', membershipId);
  if (error) throw error;

  // Accepting is the consent point: share the student's default mushaf with the
  // circle's teacher as an explicit set_collaborators grant, so it shows on the
  // teacher's /shared. The student owns the set, so this insert passes the
  // owner-insert RLS; idempotent on (set_id, user_id).
  const { data: { user } } = await supabase.auth.getUser();
  const { data: membership } = await supabase
    .from('membership')
    .select('circle:circle_id(teacher_id)')
    .eq('id', membershipId)
    .maybeSingle();
  const teacherId = (membership?.circle as unknown as { teacher_id: string } | null)?.teacher_id;
  if (!user || !teacherId || teacherId === user.id) return;

  const { data: set } = await supabase
    .from('annotation_sets')
    .select('id')
    .eq('user_id', user.id)
    .eq('is_default', true)
    .maybeSingle();
  if (!set) return;

  await supabase
    .from('set_collaborators')
    .upsert(
      { set_id: set.id, user_id: teacherId, granted_by: user.id },
      { onConflict: 'set_id,user_id', ignoreDuplicates: true },
    );
}

/** Teacher invites an existing user by email. Lands as 'pending' (D12). */
export async function inviteByEmail(
  circleId: string,
  email: string,
): Promise<MemberWithProfile> {
  const supabase = await createClientAction();
  const { data: userId, error: lookupError } = await supabase.rpc(
    'user_id_by_email',
    { _email: email.trim().toLowerCase() },
  );
  if (lookupError) throw lookupError;
  if (!userId) throw new Error('No registered user with that email');

  const { data, error } = await supabase
    .from('membership')
    .insert({ circle_id: circleId, user_id: userId, role: 'student', status: 'pending' })
    .select()
    .single();
  if (error) throw error;

  // Enrich with the invited user's name so the optimistic roster row reads the
  // same as a reload (else displayName falls back to a #<id> tag).
  const actor = (await supabase.auth.getUser()).data.user?.id ?? null;
  after(() => notifyInvite(userId, circleId, actor));

  const profiles = await getProfilesByIds([userId]);
  const p = profiles.get(userId);
  return { ...data, first_name: p?.first_name, last_name: p?.last_name };
}

/** Teacher changes a member's lifecycle status: archive / block / reactivate. */
export async function setMembershipStatus(
  membershipId: string,
  status: Membership['status'],
): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('membership')
    .update({ status })
    .eq('id', membershipId);
  if (error) throw error;
}

/** The student leaves (or declines) their own membership. Trigger enforces the
 *  self-only pending|active -> inactive transition; the teacher can reactivate. */
export async function leaveCircle(membershipId: string): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('membership')
    .update({ status: 'inactive' })
    .eq('id', membershipId);
  if (error) throw error;
}
