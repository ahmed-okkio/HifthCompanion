import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailPrefs, MemorizedRange } from '@/types';

// Settings reads, client-agnostic (PRD 0016 E1, like tracker/reads.ts). RLS scopes every row to the caller.
export type SettingsData = {
  ranges: MemorizedRange[];
  weakest: number[];
  emailPrefs: EmailPrefs;
  reminder: string | null;
  hasWirds: boolean;
};

export async function loadSettings(sb: SupabaseClient): Promise<SettingsData | null> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const [hifth, profile, wirds] = await Promise.all([
    sb.from('user_hifth').select('memorized_ranges, weakest_surahs').eq('user_id', user.id).maybeSingle(),
    sb.from('profiles').select('email_prefs, wird_reminder_time').eq('id', user.id).maybeSingle(),
    sb.from('wird').select('id').eq('user_id', user.id).is('deleted_at', null),
  ]);
  for (const r of [hifth, profile, wirds]) if (r.error) throw r.error;
  return {
    ranges: hifth.data?.memorized_ranges ?? [],
    weakest: hifth.data?.weakest_surahs ?? [],
    emailPrefs: profile.data?.email_prefs ?? {},
    reminder: profile.data?.wird_reminder_time ?? null,
    hasWirds: (wirds.data ?? []).length > 0,
  };
}
