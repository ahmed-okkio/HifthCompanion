'use server';

import { createClient, createClientAction } from '@/lib/supabase/server';
import type { MembershipNote } from '@/types';
import { getProfilesByIds } from '@/lib/services/profile';

/** A note enriched with its author's display name (when readable). */
export type NoteWithAuthor = MembershipNote & {
  first_name?: string;
  last_name?: string;
};

/** Post a note to a membership's thread (D11). author_id defaults auth.uid().
 *  Returned enriched with the author's own name so the UI can render it
 *  immediately (own profile is always readable). */
export async function postNote(
  membershipId: string,
  body: string,
): Promise<NoteWithAuthor> {
  const supabase = await createClientAction();
  const { data, error } = await supabase
    .from('membership_note')
    .insert({ membership_id: membershipId, body: body.trim() })
    .select()
    .single();
  if (error) throw error;
  const note = data as MembershipNote;
  const p = (await getProfilesByIds([note.author_id])).get(note.author_id);
  return { ...note, first_name: p?.first_name, last_name: p?.last_name };
}

/** Full thread for a membership, newest first, each note carrying its author. */
export async function listNotes(membershipId: string): Promise<NoteWithAuthor[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('membership_note')
    .select('*')
    .eq('membership_id', membershipId)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rows = (data ?? []) as MembershipNote[];
  const profiles = await getProfilesByIds(rows.map((r) => r.author_id));
  return rows.map((r) => {
    const p = profiles.get(r.author_id);
    return { ...r, first_name: p?.first_name, last_name: p?.last_name };
  });
}
