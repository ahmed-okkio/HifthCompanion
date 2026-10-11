import type { SupabaseClient } from '@supabase/supabase-js';
import { getCovering, getProfilesByIds } from '@/lib/tracker/reads';
import { displayName } from '@/lib/displayName';

// Share reads, client-agnostic (PRD 0016 E1, like tracker/reads.ts). RLS decides what is
// visible; the client only picks the UI branch from what it can see (never grants access).

type Supa = SupabaseClient;
type SetRow = { id: string; name: string; user_id: string };

export type ShareCap =
  | { kind: 'none' } // set not visible to this viewer: not found, nothing rendered (C3 [SEC])
  | { kind: 'owner' }
  | {
      kind: 'collaborator' | 'readonly';
      set: SetRow;
      ownerName: string;
      userId: string | null;
      account: { name: string; email: string } | null;
      studentPath: string | null;
    };

const nameOf = (profiles: Map<string, { first_name?: string | null; last_name?: string | null }>, id: string) =>
  displayName({ user_id: id, first_name: profiles.get(id)?.first_name ?? undefined, last_name: profiles.get(id)?.last_name ?? undefined });

/** The viewer's capability on a set (was services/share.ts resolveShareCapability, server-side). */
export async function loadShareCap(sb: Supa, setId: string): Promise<ShareCap> {
  const { data: { user } } = await sb.auth.getUser();
  const { data: set, error } = await sb.from('annotation_sets').select('id, name, user_id').eq('id', setId).maybeSingle();
  if (error) throw error;
  if (!set) return { kind: 'none' };
  if (user && set.user_id === user.id) return { kind: 'owner' };

  const ids = user ? [set.user_id, user.id] : [set.user_id];
  const [profiles, covering] = await Promise.all([
    getProfilesByIds(sb, ids),
    // 0013 D3: a covering substitute can SELECT the covered student's default set but not write
    // it, so coverage forces read-only. Fails closed (less access, never more).
    user ? getCovering(sb).catch(() => []) : Promise.resolve([]),
  ]);
  const account = user ? { name: nameOf(profiles, user.id), email: user.email ?? '' } : null;
  const ownerName = nameOf(profiles, set.user_id);
  const collaborator = !!user && !covering.some((r) => r.default_set_id === setId);
  const studentPath = collaborator ? await studentPathForOwner(sb, user!.id, set.user_id).catch(() => null) : null;
  return { kind: collaborator ? 'collaborator' : 'readonly', set, ownerName, userId: user?.id ?? null, account, studentPath };
}

/** Teacher -> their student's profile page for the set owner, or null (at most one row). */
async function studentPathForOwner(sb: Supa, viewerId: string, ownerId: string): Promise<string | null> {
  const { data, error } = await sb
    .from('membership')
    .select('id, circle:circle_id!inner(id, teacher_id)')
    .eq('user_id', ownerId)
    .eq('role', 'student')
    .eq('circle.teacher_id', viewerId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return `/tracker/${(data.circle as unknown as { id: string }).id}/student/${data.id}`;
}

export type SharedSet = { id: string; name: string; owner: string };

/** Sets shared with me (collaborator-scoped, so my own sets never appear). */
export async function loadSharedWithMe(sb: Supa): Promise<SharedSet[]> {
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return [];
  const { data: grants, error } = await sb.from('set_collaborators').select('set_id').eq('user_id', user.id);
  if (error) throw error;
  const ids = (grants ?? []).map((g: { set_id: string }) => g.set_id);
  if (ids.length === 0) return [];
  const { data: sets, error: e2 } = await sb.from('annotation_sets').select('id, name, user_id').in('id', ids);
  if (e2) throw e2;
  const rows = (sets ?? []) as SetRow[];
  const profiles = await getProfilesByIds(sb, rows.map((s) => s.user_id));
  return rows.map((s) => ({ id: s.id, name: s.name, owner: nameOf(profiles, s.user_id) }));
}
