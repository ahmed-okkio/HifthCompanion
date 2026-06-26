import type { MemberWithProfile } from '@/types';

/**
 * Human-facing name for a tracker member. Falls back to a short id tag when no
 * profile is readable (legacy accounts created before names existed, or a user
 * the caller can't see a profile for). Pure — safe in both server and client.
 */
export function displayName(m: Pick<MemberWithProfile, 'user_id' | 'first_name' | 'last_name'>): string {
  const full = `${m.first_name ?? ''} ${m.last_name ?? ''}`.trim();
  return full || `#${m.user_id.slice(0, 6)}`;
}
