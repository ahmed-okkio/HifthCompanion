'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { Circle, Membership, MemberWithProfile } from '@/types';
import { getProfilesByIds } from '@/lib/services/profile';

export type MembershipWithCircle = Membership & { circle: Circle };

/** The current user's memberships, each with its circle (tracker landing). */
export async function getMyMembershipsWithCircle(): Promise<MembershipWithCircle[]> {
  const supabase = await createClient();
  // Must scope to the current user: the membership RLS also grants teachers read
  // on every student row in their circles, so without this filter a teacher's
  // landing would list their students' rows as circles they "joined".
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('membership')
    .select('*, circle:circle_id(*)')
    .eq('user_id', user?.id ?? '')
    .order('joined_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as MembershipWithCircle[];
}

/** The current user's memberships (across all circles). */
export async function getMyMemberships(): Promise<Membership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('membership')
    .select('*')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
    .order('joined_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

/** All memberships in a circle (teacher roster view). */
export async function getCircleMembers(circleId: string): Promise<Membership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('membership')
    .select('*')
    .eq('circle_id', circleId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Circle roster enriched with each member's display name (when readable). */
export async function getCircleMembersWithProfiles(
  circleId: string,
): Promise<MemberWithProfile[]> {
  const members = await getCircleMembers(circleId);
  const profiles = await getProfilesByIds(members.map((m) => m.user_id));
  return members.map((m) => {
    const p = profiles.get(m.user_id);
    return { ...m, first_name: p?.first_name, last_name: p?.last_name };
  });
}

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
}

/**
 * The current default annotation set id of a membership's student (D13). Used by
 * the teacher's Mushaf button. RLS (teacher_reads_default_set) only exposes it
 * while the membership is active. Returns null when the student has no default.
 */
export async function getStudentDefaultSetId(
  membershipId: string,
): Promise<string | null> {
  const supabase = await createClient();
  const { data: member, error: memError } = await supabase
    .from('membership')
    .select('user_id')
    .eq('id', membershipId)
    .maybeSingle();
  if (memError) throw memError;
  if (!member) return null;

  const { data, error } = await supabase
    .from('annotation_sets')
    .select('id')
    .eq('user_id', member.user_id)
    .eq('is_default', true)
    .maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

/** Teacher invites an existing user by email. Lands as 'pending' (D12). */
export async function inviteByEmail(
  circleId: string,
  email: string,
): Promise<Membership> {
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
  return data;
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
