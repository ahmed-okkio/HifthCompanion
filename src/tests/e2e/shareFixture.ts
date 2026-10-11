import type { APIRequestContext, Page } from '@playwright/test';

// Share fixtures (0016 M7): sets live in the server mock store, whose annotation_sets reads mirror
// RLS (owner, collaborator grant, or covering substitute). Unique ids: specs share one store.
export const ME = '52345ff6-3348-40d5-b6d8-1234567890ab'; // the default mock user
export const OTHER = '6a1b2c3d-4e5f-6789-abcd-0123456789ef'; // student@example.com
// Read-only shares are covered by their own identity: a covering row for ME would show up in
// every spec's /tracker/covering (one shared store).
export const SUB = 'c0ffee00-0000-4000-8000-000000000001';

/** Act as SUB in this page's browser (the mock client reads the acting user from this cookie). */
export async function actAsSubstitute(page: Page) {
  await page.context().addCookies([
    { name: 'sb-auth-token', value: encodeURIComponent(JSON.stringify({ sub: SUB })), domain: 'localhost', path: '/' },
  ]);
}

/** A set owned by OTHER that ME can edit (collaborator), SUB can only view (covering), or nobody else sees. */
export async function seedShare(
  request: APIRequestContext,
  access: 'collaborator' | 'readonly' | 'private',
  id = `share${Date.now()}${Math.floor(Math.random() * 1e6)}`,
) {
  const name = `Shared Set ${id}`;
  const seed: Record<string, unknown[]> = {
    annotation_sets: [{ id, user_id: OTHER, name, created_at: new Date().toISOString() }],
  };
  if (access === 'collaborator') seed.set_collaborators = [{ set_id: id, user_id: ME, created_at: new Date().toISOString() }];
  if (access === 'readonly') seed.covering = [{ substitute_user_id: SUB, default_set_id: id }];
  const res = await request.post('/api/test/tracker', { data: { seed } });
  if (!res.ok()) throw new Error(`seed failed: ${res.status()}`);
  return { id, name };
}
