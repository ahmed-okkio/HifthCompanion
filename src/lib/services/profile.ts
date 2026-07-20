'use server';

import { createClient } from '@/lib/supabase/server';
import { displayName } from '@/lib/displayName';
import { validate, normalize } from '@/lib/memorization';
import type { Locale } from '@/lib/i18n/config';
import type { Profile, MemorizedRange, EmailPrefs } from '@/types';

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

/** The caller's own profile row (null when unauthenticated or no row). */
export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, email_prefs, locale')
    .eq('id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}

/**
 * Merge `partial` into the caller's own email_prefs. id is always auth.uid() —
 * the client never supplies it — and the self-only "User updates own profile"
 * RLS policy is the enforcing backstop. Other profile columns are untouched.
 */
export async function saveEmailPrefs(partial: EmailPrefs): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const current = (await getMyProfile())?.email_prefs ?? {};
  const { error } = await supabase
    .from('profiles')
    .update({ email_prefs: { ...current, ...partial }, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) throw error;
}

/**
 * Persist the caller's UI language so server-side email can be written in it —
 * the cookie i18n normally reads is unavailable when a teacher's action sends
 * mail to a student. id is always auth.uid(); the self-only "User updates own
 * profile" RLS policy is the enforcing backstop.
 */
export async function saveLocale(locale: Locale, timezone?: string): Promise<void> {
  // One round trip when the switcher knows both.
  await patchOwnProfile(timezone ? { locale, timezone } : { locale });
}

/**
 * Persist the caller's IANA timezone so session/deadline times in email render
 * in *their* zone — teacher and student are often in different ones. Captured
 * on app load (I18nProvider), best-effort.
 */
export async function saveTimezone(timezone: string): Promise<void> {
  await patchOwnProfile({ timezone });
}

async function patchOwnProfile(patch: Record<string, unknown>): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', user.id);
  if (error) throw error;
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

/** A student's memorized ranges, readable by a teacher of an active membership
 *  (teacher-read RLS on user_hifth). Empty when the row/access is absent. */
export async function getStudentMemorization(userId: string): Promise<MemorizedRange[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('user_hifth')
    .select('memorized_ranges')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.memorized_ranges ?? [];
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
