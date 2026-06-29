'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { AnnotationSet } from '@/types';
import { getProfilesByIds } from '@/lib/services/profile';

/** An account resolved by email, plus whether it was already a collaborator. */
export type AddByEmailResult = {
  id: string;
  first_name: string;
  last_name: string;
  alreadyCollaborator: boolean;
};

/** A current collaborator on a set, enriched with display name (when readable). */
export type Collaborator = {
  user_id: string;
  first_name?: string;
  last_name?: string;
  created_at: string;
};

/** Share a set with an existing account by email (contract B1–B5). */
export async function addByEmail(setId: string, email: string): Promise<AddByEmailResult> {
  const e = email.trim().toLowerCase();
  const supabase = await createClientAction();

  const { data, error } = await supabase.rpc('account_by_email', { _email: e });
  if (error) throw error;
  const account = data?.[0] as { id: string; first_name: string; last_name: string } | undefined;
  if (!account) throw new Error('No Hifth Companion account found'); // B2

  const me = (await supabase.auth.getUser()).data.user?.id ?? '';
  if (account.id === me) throw new Error("You can't share a set with yourself"); // B3

  // B4: idempotent on the (set_id, user_id) unique. ignoreDuplicates skips an
  // existing grant, so an empty returned set means they were already a collaborator.
  const { data: inserted, error: insertError } = await supabase
    .from('set_collaborators')
    .upsert(
      { set_id: setId, user_id: account.id, granted_by: me },
      { onConflict: 'set_id,user_id', ignoreDuplicates: true },
    )
    .select('user_id');
  if (insertError) throw insertError;

  return {
    id: account.id,
    first_name: account.first_name,
    last_name: account.last_name,
    alreadyCollaborator: (inserted?.length ?? 0) === 0,
  };
}

/** Current collaborators on a set, enriched with display names. */
export async function list(setId: string): Promise<Collaborator[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('set_collaborators')
    .select('user_id, created_at')
    .eq('set_id', setId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as { user_id: string; created_at: string }[];
  const profiles = await getProfilesByIds(rows.map((r) => r.user_id));
  return rows.map((r) => {
    const p = profiles.get(r.user_id);
    return { user_id: r.user_id, first_name: p?.first_name, last_name: p?.last_name, created_at: r.created_at };
  });
}

/** Revoke a collaborator's grant on a set. */
export async function remove(setId: string, userId: string): Promise<void> {
  const supabase = await createClientAction();
  const { error } = await supabase
    .from('set_collaborators')
    .delete()
    .eq('set_id', setId)
    .eq('user_id', userId);
  if (error) throw error;
}

/** Sets shared WITH the current user (collaborator-read RLS makes them visible). */
export async function sharedWithMe(): Promise<AnnotationSet[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('set_collaborators')
    .select('annotation_sets:set_id(*)')
    .eq('user_id', user.id);
  if (error) throw error;

  const rows = (data ?? []) as { annotation_sets: AnnotationSet | null }[];
  return rows
    .map((r) => r.annotation_sets)
    .filter((s): s is AnnotationSet => s != null);
}
