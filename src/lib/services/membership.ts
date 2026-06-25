'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { Halaqah, Membership } from '@/types';

export type MembershipWithHalaqah = Membership & { halaqah: Halaqah };

/** The current user's memberships, each with its halaqah (tracker landing). */
export async function getMyMembershipsWithHalaqah(): Promise<MembershipWithHalaqah[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('membership')
    .select('*, halaqah:halaqah_id(*)')
    .order('joined_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as MembershipWithHalaqah[];
}

/** The current user's memberships (across all halaqat). */
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

/** All memberships in a halaqah (teacher roster view). */
export async function getHalaqahMembers(halaqahId: string): Promise<Membership[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('membership')
    .select('*')
    .eq('halaqah_id', halaqahId)
    .order('joined_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

/** Join a halaqah by id as a student (M1-6). */
export async function joinHalaqah(halaqahId: string): Promise<Membership> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('membership')
    .insert({ halaqah_id: halaqahId, role: 'student' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Designate which annotation set the teacher may read for this membership. */
export async function setSharedSet(
  membershipId: string,
  sharedSetId: string | null,
): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('membership')
    .update({ shared_set_id: sharedSetId })
    .eq('id', membershipId);
  if (error) throw error;
}

/** Teacher invites an existing user by email (M1-5). No account provisioning. */
export async function inviteByEmail(
  halaqahId: string,
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
    .insert({ halaqah_id: halaqahId, user_id: userId, role: 'student' })
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
