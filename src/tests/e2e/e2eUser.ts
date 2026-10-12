import type { APIRequestContext, BrowserContext } from '@playwright/test';

/**
 * F4: a fresh mock identity for this context. Specs share one server mock store across
 * parallel workers (and --repeat-each copies), so a test that owns "the" default user's rows
 * gets them wiped or doubled by its siblings. The mock resolves the acting user from
 * sb-auth-token {sub}, so a random sub gives each test rows nobody else reads or resets.
 * `profile` seeds a profiles row (column defaults) for flows that read or write it.
 */
export async function asNewUser(context: BrowserContext, { profile = false } = {}): Promise<string> {
  const id = crypto.randomUUID();
  await context.addCookies([
    { name: 'sb-auth-token', value: JSON.stringify({ sub: id }), domain: 'localhost', path: '/' },
    { name: 'x-e2e-test', value: 'true', domain: 'localhost', path: '/' },
  ]);
  if (profile) {
    await context.request.post('/api/test/tracker', {
      data: { seed: { profiles: [{ id, first_name: 'Mock', last_name: 'User', email_prefs: {}, wird_reminder_time: '18:00:00' }] } },
    });
  }
  return id;
}

/**
 * Seed a set for `userId` (default: the mock user) and return its id. Sets are off in the UI
 * (SETS_ENABLED), so specs open the reader on it with `?set=<id>` instead of creating it on /sets.
 */
export async function seedSet(request: APIRequestContext, name: string, userId = '52345ff6-3348-40d5-b6d8-1234567890ab'): Promise<string> {
  const id = `set${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const res = await request.post('/api/test/tracker', {
    data: { seed: { annotation_sets: [{ id, user_id: userId, name, created_at: new Date().toISOString() }] } },
  });
  if (!res.ok()) throw new Error(`seedSet failed: ${res.status()}`);
  return id;
}
