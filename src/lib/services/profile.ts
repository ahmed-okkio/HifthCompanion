'use server';

import { createClient } from '@/lib/supabase/server';
import { displayName } from '@/lib/displayName';
import { validate, normalize } from '@/lib/memorization';
import type { Profile, MemorizedRange } from '@/types';

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
 * caller may read (self + circle co-members), so missing ids are expected and
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

/** The caller's own memorized ranges + onboarding timestamp (empty/null if none). */
export async function getMyMemorization(): Promise<{
  ranges: MemorizedRange[];
  weakest: number[];
  onboarded_at: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ranges: [], weakest: [], onboarded_at: null };

  const { data, error } = await supabase
    .from('user_hifth')
    .select('memorized_ranges, weakest_surahs, onboarded_at')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return {
    ranges: data?.memorized_ranges ?? [],
    weakest: data?.weakest_surahs ?? [],
    onboarded_at: data?.onboarded_at ?? null,
  };
}

/** Upsert the caller's own hifth path. Re-validates+normalizes server-side;
 *  user_id is always the caller — client is never trusted for it. Weakest surahs
 *  are clamped to valid surah numbers that actually appear in the saved ranges. */
export async function saveMemorization(
  ranges: MemorizedRange[],
  weakest: number[] = [],
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  if (!validate(ranges)) throw new Error('Invalid memorized ranges');
  const clean = normalize(ranges);

  const memorizedSurahs = new Set(clean.map((r) => r.surah));
  const weak = [...new Set(weakest)].filter((s) => memorizedSurahs.has(s)).sort((a, b) => a - b);

  const now = new Date().toISOString();
  const { error } = await supabase.from('user_hifth').upsert(
    { user_id: user.id, memorized_ranges: clean, weakest_surahs: weak, onboarded_at: now, updated_at: now },
    { onConflict: 'user_id' },
  );
  if (error) throw error;
}
