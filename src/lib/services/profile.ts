'use server';

import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/types';

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
