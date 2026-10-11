import type { BrowserContext } from '@playwright/test';

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
