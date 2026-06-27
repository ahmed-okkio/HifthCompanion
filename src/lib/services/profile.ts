'use server';

import { createClient } from '@/lib/supabase/server';
import { displayName } from '@/lib/displayName';
import type { Profile } from '@/types';

/**
 * Chrome summary (display name + email) for the account menu, built from the
 * auth user the caller already loaded — avoids a second getUser() round-trip.
 * Name falls back to a short-id tag via displayName() when no profile row is
 * readable.
 */
export async function getMyChrome(
  user: { id: string; email?: string | null },
): Promise<{ name: string; email: string }> {
  const profiles = await getProfilesByIds([user.id]);
  const p = profiles.get(user.id);
  const name = displayName({
    user_id: user.id,
    first_name: p?.first_name,
    last_name: p?.last_name,
  });
  return { name, email: user.email ?? '' };
}

/**
 * Profiles for the given user ids, keyed by id. RLS only returns rows the
 * caller may read (self + halaqah co-members), so missing ids are expected and
 * callers fall back to a short-id tag via displayName().
 */
export async function getProfilesByIds(ids: string[]): Promise<Map<string, Profile>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (unique.length === 0) return new Map();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name')
    .in('id', unique);

  if (error) throw error;
  return new Map((data ?? []).map((p: Profile) => [p.id, p] as const));
}
