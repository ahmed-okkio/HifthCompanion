import { createClient } from '@/lib/supabase/server';
import { getMyChrome, getProfilesByIds } from '@/lib/services/profile';
import { displayName } from '@/lib/displayName';
import { getStudentPagePathForOwner } from '@/lib/services/membership';
import { getCovering } from '@/lib/services/substitution';

/**
 * Resolve the viewer's capability for a shared set from RLS visibility (the client never decides
 * permissions). Shared by the share layout (which hoists the persistent shell) and the [page]
 * route (which renders the per-page content), so both agree on the branch without duplicating the
 * auth logic. The layout runs this once per set (persists across page turns); the page per nav.
 */
export type ShareCapability =
  | { kind: 'owner'; setId: string }
  | {
      kind: 'collaborator';
      setId: string;
      user: { id: string };
      annotationSet: { id: string; name: string; user_id: string };
      account: Awaited<ReturnType<typeof getMyChrome>>;
      ownerName: string;
      studentPath: string | null;
    }
  | {
      kind: 'readonly';
      setId: string;
      annotationSet: { id: string; name: string; user_id: string } | null;
      account: Awaited<ReturnType<typeof getMyChrome>> | null;
      ownerName?: string;
    };

export async function resolveShareCapability(setId: string): Promise<ShareCapability> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // E2E: the mock DB doesn't share state across server requests, so the set can't resolve —
  // fall through to READ_ONLY (the share spec clears cookies and asserts the read-only canvas).
  const isE2E = process.env.PLAYWRIGHT_TEST === 'true';

  const annotationSet = isE2E
    ? null
    : (
        await supabase
          .from('annotation_sets')
          .select('id, name, user_id')
          .eq('id', setId)
          .maybeSingle()
      ).data;

  // OWNER — hand off to the normal reader chrome (handled by the page, which has the page number).
  if (annotationSet && user && annotationSet.user_id === user.id) {
    return { kind: 'owner', setId };
  }

  // 0013 D3 — a covering SUBSTITUTE can now SELECT the covered student's default
  // set (covers_default_set), which would otherwise fall into the collaborator
  // branch and render an editable canvas whose every write RLS-rejects. Coverage
  // is read from covering_sessions() — the same DB-owned 12h gate, no expiry
  // logic here — and forces the read-only branch. Fails closed, and two viewers
  // lose editing for the coverage window only: a sub who is also a genuine
  // collaborator on the set, and a teacher who covers a session for the SAME
  // student in someone else's circle (they then open that student's set from
  // their own circle read-only until the 12h window lapses). Both acceptable —
  // the failure mode is "less access than earned", never more.
  const coveringThisSet =
    !!annotationSet && !!user &&
    (await getCovering().catch(() => [])).some((r) => r.default_set_id === setId);

  // COLLABORATOR — set visible but viewer is not the owner: editable canvas locked to this set.
  if (annotationSet && user && !coveringThisSet) {
    const owner = (await getProfilesByIds([annotationSet.user_id])).get(annotationSet.user_id);
    const ownerName = displayName({
      user_id: annotationSet.user_id,
      first_name: owner?.first_name,
      last_name: owner?.last_name,
    });
    const account = await getMyChrome(user);
    const studentPath = await getStudentPagePathForOwner(annotationSet.user_id).catch(() => null);
    return { kind: 'collaborator', setId, user: { id: user.id }, annotationSet, account, ownerName, studentPath };
  }

  // READ_ONLY — guest or signed-in non-grantee.
  const account = user ? await getMyChrome(user) : null;
  const owner = annotationSet
    ? (await getProfilesByIds([annotationSet.user_id])).get(annotationSet.user_id)
    : undefined;
  const ownerName = annotationSet
    ? displayName({ user_id: annotationSet.user_id, first_name: owner?.first_name, last_name: owner?.last_name })
    : undefined;
  return { kind: 'readonly', setId, annotationSet, account, ownerName };
}
