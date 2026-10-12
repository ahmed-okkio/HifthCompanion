import { test, expect, type Page } from '@playwright/test';
import { seedShare } from './shareFixture';
import { asNewUser } from './e2eUser';

// PRD 0016 M3 smoke (SW enabled): shell routes are answered by the service worker, offline
// too, in the user's locale; a shell launch without a session goes to /login. Full F2 in M9.

function guardConsole(page: Page) {
  page.on('console', (msg) => {
    // Offline, the client's background fetches fail by design; anything else is a bug.
    if (msg.type() === 'error' && !/Failed to load resource|ERR_INTERNET_DISCONNECTED/.test(msg.text()))
      throw new Error(`console error: ${msg.text()}`);
  });
}

// Wait until this page is SW-controlled and the build's shells are precached.
async function swReady(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(async () => {
        if (!navigator.serviceWorker.controller) return false;
        const shell = (await caches.keys()).find((k) => k.startsWith('hc-shell-'));
        return !!shell && (await (await caches.open(shell)).keys()).some((r) => r.url.endsWith('/wird.html'));
      }),
    )
    .toBe(true);
}

test('shell routes are served by the SW, online and offline (D2, D3)', async ({ page, context }) => {
  guardConsole(page);
  await page.goto('/wird');
  await swReady(page);

  const online = await page.goto('/wird/manage');
  expect(online?.fromServiceWorker()).toBe(true);
  await expect(page).toHaveTitle(/wird/i);

  await context.setOffline(true);
  const offline = await page.goto('/wird');
  expect(offline?.fromServiceWorker()).toBe(true);
  await expect(page).toHaveTitle(/wird/i);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');

  // D4: a route without a shell falls back to the offline page.
  await page.goto('/onboarding');
  await expect(page).toHaveTitle(/Offline/);
  await context.setOffline(false);
});

// The page indicator in the reader chrome shows which page rendered.
const pageShown = (page: Page) => page.locator('[title="Click to jump to page"]');

test('/reader and /reader/<n> are SW shells; the page comes from the URL (M5, D3)', async ({ page, context }) => {
  guardConsole(page);
  await page.goto('/wird');
  await swReady(page);

  const res = await page.goto('/reader');
  expect(res?.fromServiceWorker()).toBe(true);
  // The index redirect lands on a real page with its canvas and own data.
  await expect(page).toHaveURL(/\/reader\/\d+/);
  await expect(page.locator('.upper-canvas')).toBeVisible();

  // Online: /reader/9 is answered by the SW from the static shell and renders page 9.
  const online = await page.goto('/reader/9');
  expect(online?.fromServiceWorker()).toBe(true);
  await expect(pageShown(page)).toHaveText('9');
  await expect(page.locator('.upper-canvas')).toBeVisible();

  // In-app nav + back/forward stay client-side (no document reload) across the rewrite.
  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
  const next = page.locator('button[aria-label="Next page"]:visible');
  const box = (await next.boundingBox())!;
  await next.click({ position: { x: box.width - 10, y: box.height / 2 } });
  await expect(page).toHaveURL(/\/reader\/10(\?|$)/);
  await expect(pageShown(page)).toHaveText('10');
  await page.goBack();
  await expect(page).toHaveURL(/\/reader\/9(\?|$)/);
  await expect(pageShown(page)).toHaveText('9');
  await page.goForward();
  await expect(page).toHaveURL(/\/reader\/10(\?|$)/);
  await expect(pageShown(page)).toHaveText('10');
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);

  // Offline cold launch of the visited page: SW shell with chrome, canvas and page 9.
  // "Visited": the reader data is persisted (E2; the persister is throttled to 1s).
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<string>((resolve) => {
            const r = indexedDB.open('keyval-store');
            r.onsuccess = () => {
              const g = r.result.transaction('keyval').objectStore('keyval').get('hc-query');
              g.onsuccess = () =>
                resolve(JSON.stringify((g.result?.clientState?.queries ?? []).map((q: { queryKey: unknown }) => q.queryKey)));
            };
            r.onerror = () => resolve('');
          }),
      ),
    )
    .toMatch(/\["me"\].*\["sets"\]|\["sets"\].*\["me"\]/);
  await context.setOffline(true);
  const cold = await context.newPage();
  guardConsole(cold);
  const off = await cold.goto('/reader/9');
  expect(off?.fromServiceWorker()).toBe(true);
  await expect(pageShown(cold)).toHaveText('9');
  await expect(cold.locator('nav').first()).toBeVisible();
  await expect(cold.locator('.upper-canvas')).toBeVisible();
  await expect(cold).not.toHaveTitle(/Offline/);
  await context.setOffline(false);
});

test('a bad /reader page number shows not-found or redirects, without console errors', async ({ page }) => {
  guardConsole(page);
  await page.goto('/wird');
  await swReady(page);
  await page.goto('/reader/9999');
  await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  await page.goto('/reader/7-x');
  await expect(page).toHaveURL(/\/reader\/7(\?|$)/);
  await expect(page.locator('.upper-canvas')).toBeVisible();
  await expect(pageShown(page)).toHaveText('7');
});

test('the shell follows the posted locale, incl. rtl (D7)', async ({ page }) => {
  guardConsole(page);
  await page.goto('/wird');
  await swReady(page);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        document.cookie = 'locale=ar; path=/';
        const ch = new MessageChannel();
        ch.port1.onmessage = () => resolve();
        navigator.serviceWorker.controller!.postMessage({ type: 'locale', locale: 'ar' }, [ch.port2]);
      }),
  );
  const res = await page.reload();
  expect(res?.fromServiceWorker()).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page).toHaveTitle(/الورد/);
});

test('the page auto-posts the locale cookie to a fresh SW, not only when it is the first cookie (D7)', async ({ page, context }) => {
  guardConsole(page);
  // Another cookie ahead of locale: the regex must match after "; ".
  await context.addCookies([
    { name: 'aaa-first', value: '1', domain: 'localhost', path: '/' },
    { name: 'locale', value: 'ar', domain: 'localhost', path: '/' },
  ]);
  await page.goto('/wird');
  expect(await page.evaluate(() => document.cookie.indexOf('locale=') > 0)).toBe(true);
  await swReady(page);
  // No manual postMessage: wait for ServiceWorkerRegister's own post to land.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const hit = await (await caches.open('hc-locale')).match('/__hc-locale');
        return hit ? hit.text() : null;
      }),
    )
    .toBe('ar');
  const res = await page.reload();
  expect(res?.fromServiceWorker()).toBe(true);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
});

test('each cached shell has its /_next/static assets precached (skew)', async ({ page }) => {
  guardConsole(page);
  await page.goto('/wird');
  await swReady(page);
  const missing = await page.evaluate(async () => {
    const shellKey = (await caches.keys()).find((k) => k.startsWith('hc-shell-'))!;
    const shells = await caches.open(shellKey);
    const manifestReq = (await shells.keys()).find((r) => r.url.endsWith('/manifest.json'))!;
    const { assets } = await (await shells.match(manifestReq))!.json();
    const statics = await caches.open('hc-static-v1');
    const out: string[] = [];
    for (const [shell, urls] of Object.entries(assets as Record<string, string[]>)) {
      if (!(await shells.match(manifestReq.url.replace('manifest.json', shell)))) continue;
      for (const u of urls) if (!(await statics.match(u))) out.push(u);
    }
    return { out, count: Object.keys(assets).length };
  });
  expect(missing.count).toBeGreaterThan(0);
  expect(missing.out).toEqual([]);
});

/** Persisted query keys (IDB, throttled 1s) — "visited" means the data is in here. */
const persistedKeys = (page: Page) =>
  page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const r = indexedDB.open('keyval-store');
        r.onsuccess = () => {
          const g = r.result.transaction('keyval').objectStore('keyval').get('hc-query');
          g.onsuccess = () =>
            resolve(JSON.stringify((g.result?.clientState?.queries ?? []).map((q: { queryKey: unknown }) => q.queryKey)));
        };
        r.onerror = () => resolve('');
      }),
  );

test('/tracker/<id> cold-launches offline from the SW with cached data; /tracker/covering is its own shell (M6)', async ({ page, context }) => {
  guardConsole(page);
  // A circle the mock user teaches, plus one student. Unique ids: the server store is shared.
  const id = `pwa${Date.now()}`;
  const name = `PWA Circle ${id}`;
  const statuses = [{ label: 'Good', polarity: 'positive' }];
  await page.request.post('/api/test/tracker', {
    data: {
      seed: {
        circle: [{ id, name, teacher_id: '52345ff6-3348-40d5-b6d8-1234567890ab', invite_code: id, student_statuses: statuses, teacher_statuses: statuses, created_at: new Date().toISOString() }],
        membership: [{ id: `${id}-t`, circle_id: id, user_id: '52345ff6-3348-40d5-b6d8-1234567890ab', role: 'teacher', status: 'active', schedule: null, joined_at: new Date().toISOString() }],
      },
    },
  });
  await page.goto('/wird');
  await swReady(page);

  // /tracker/covering is the literal route's own shell, not the "/tracker/:circleId" one.
  const cov = await page.goto('/tracker/covering');
  expect(cov?.fromServiceWorker()).toBe(true);
  await expect(page.getByText('Nothing to cover right now.')).toBeVisible();

  const online = await page.goto(`/tracker/${id}`);
  expect(online?.fromServiceWorker()).toBe(true);
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible();
  await expect.poll(() => persistedKeys(page)).toContain(`["tracker","circle","${id}"]`);

  await context.setOffline(true);
  const cold = await context.newPage();
  guardConsole(cold);
  const off = await cold.goto(`/tracker/${id}`);
  expect(off?.fromServiceWorker()).toBe(true);
  await expect(cold).not.toHaveTitle(/Offline/);
  await expect(cold.getByRole('heading', { name, level: 1 })).toBeVisible();
  await expect(cold.getByRole('button', { name: new RegExp(`^${name}`) })).toBeVisible(); // rail, cached
  await expect(cold.getByText('Invite link', { exact: true })).toBeVisible();
  await context.setOffline(false);
});

test('a visited /share/<id>/<page> cold-launches offline from the SW with cached data (M7)', async ({ page, context }) => {
  guardConsole(page);
  const { id, name } = await seedShare(page.request, 'collaborator');
  await page.goto('/wird');
  await swReady(page);

  const online = await page.goto(`/share/${id}/4`);
  expect(online?.fromServiceWorker()).toBe(true);
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.locator('[title="Click to jump to page"]')).toHaveText('4');
  await expect.poll(() => persistedKeys(page)).toContain(`["share","${id}"]`);

  await context.setOffline(true);
  const cold = await context.newPage();
  guardConsole(cold);
  const off = await cold.goto(`/share/${id}/4`);
  expect(off?.fromServiceWorker()).toBe(true);
  await expect(cold).not.toHaveTitle(/Offline/);
  await expect(cold.getByText(name)).toBeVisible();
  await expect(cold.locator('[title="Click to jump to page"]')).toHaveText('4');
  await expect(cold.locator('.upper-canvas')).toBeVisible();
  await expect(cold).toHaveURL(new RegExp(`/share/${id}/4$`));
  await context.setOffline(false);
});

test('a visited /shared cold-launches offline from the SW with cached data (M7)', async ({ page, context }) => {
  guardConsole(page);
  const { id, name } = await seedShare(page.request, 'collaborator');
  await page.goto('/wird');
  await swReady(page);

  const online = await page.goto('/shared');
  expect(online?.fromServiceWorker()).toBe(true);
  await expect(page.locator(`a[href="/share/${id}"]`)).toContainText(name);
  await expect.poll(() => persistedKeys(page)).toContain('["shared"]');

  await context.setOffline(true);
  const cold = await context.newPage();
  guardConsole(cold);
  const off = await cold.goto('/shared');
  expect(off?.fromServiceWorker()).toBe(true);
  await expect(cold).not.toHaveTitle(/Offline/);
  await expect(cold.locator(`a[href="/share/${id}"]`)).toContainText(name);
  await context.setOffline(false);
});

// M8: a fresh user whose saved email prefs have "homework" off, so cached data is observable.
async function settingsUser(context: import('@playwright/test').BrowserContext) {
  const id = await asNewUser(context);
  await seedProfile(context, id);
  return id;
}
async function seedProfile(context: import('@playwright/test').BrowserContext, id: string) {
  await context.request.post('/api/test/tracker', {
    data: { seed: { profiles: [{ id, first_name: 'Mock', last_name: 'User', email_prefs: { homework: false }, wird_reminder_time: null }] } },
  });
}
const homework = (page: Page) => page.locator('input[aria-labelledby="pref-homework"]');

test('a visited /settings cold-launches offline from the SW with cached data (M8)', async ({ page, context }) => {
  guardConsole(page);
  await settingsUser(context);
  await page.goto('/wird');
  await swReady(page);

  const online = await page.goto('/settings');
  expect(online?.fromServiceWorker()).toBe(true);
  await expect(homework(page)).not.toBeChecked();
  await expect(page.locator('input[aria-labelledby="pref-invite"]')).toBeChecked();
  await expect.poll(() => persistedKeys(page)).toContain('["me","settings"]');

  await context.setOffline(true);
  const cold = await context.newPage();
  guardConsole(cold);
  const off = await cold.goto('/settings');
  expect(off?.fromServiceWorker()).toBe(true);
  await expect(cold).not.toHaveTitle(/Offline/);
  await expect(homework(cold)).not.toBeChecked();
  await expect(cold.locator('input[aria-labelledby="pref-invite"]')).toBeChecked();
  await context.setOffline(false);
});

test('an offline settings write is refused with an error and rolled back (E10, M8)', async ({ page, context }) => {
  guardConsole(page);
  await settingsUser(context);
  await page.goto('/settings');
  await expect(homework(page)).not.toBeChecked();

  await context.setOffline(true);
  await homework(page).click();
  await expect(page.getByText("You're offline. This change was not saved.")).toBeVisible();
  await expect(homework(page)).not.toBeChecked();
  await context.setOffline(false);

  // Nothing reached the server: a fresh load still shows it off.
  await page.reload();
  await expect(homework(page)).not.toBeChecked();
});

test('switching to ar in the menu makes the next shell ar + rtl, offline too (B5/D7, M8)', async ({ page, context }) => {
  guardConsole(page);
  await settingsUser(context);
  await page.goto('/settings');
  await swReady(page);
  await expect(homework(page)).not.toBeChecked();

  await page.getByRole('button', { name: 'Account' }).click();
  await Promise.all([page.waitForEvent('load'), page.getByLabel('Language').selectOption('ar')]);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByRole('heading', { name: 'الإعدادات' })).toBeVisible();
  await expect.poll(() => persistedKeys(page)).toContain('["me","settings"]');

  await context.setOffline(true);
  const cold = await context.newPage();
  guardConsole(cold);
  const off = await cold.goto('/settings');
  expect(off?.fromServiceWorker()).toBe(true);
  await expect(cold.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(cold.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(cold.getByRole('heading', { name: 'الإعدادات' })).toBeVisible();
  await expect(homework(cold)).not.toBeChecked();
  await context.setOffline(false);
});

test('logging out from /settings wipes the persisted settings data (E6, M8)', async ({ page, context }) => {
  guardConsole(page);
  const id = await settingsUser(context);
  await page.goto('/settings');
  await expect(homework(page)).not.toBeChecked();
  await expect.poll(() => persistedKeys(page)).toContain('["me","settings"]');
  await expect.poll(() => rawIdb(page)).toContain('Mock User');

  await logout(page);
  // A mounted query may re-create its key (signed out, data null) after the wipe; what must be
  // gone is every query's data and any trace of the user (id, name, saved prefs).
  await expect.poll(() => leaks(page, [id, 'Mock User', 'homework'])).toEqual([]);
});

test('/install is served from the SW, with its QR code built client-side (M8)', async ({ page, context }) => {
  guardConsole(page);
  await page.goto('/wird');
  await swReady(page);
  const res = await page.goto('/install');
  expect(res?.fromServiceWorker()).toBe(true);
  await expect(page.getByText('Scan this code with your phone to install the app.')).toBeVisible();
  await expect(page.locator('[role="img"] svg')).toBeVisible();

  await context.setOffline(true);
  const off = await page.goto('/install');
  expect(off?.fromServiceWorker()).toBe(true);
  await expect(page).not.toHaveTitle(/Offline/);
  await context.setOffline(false);
});

// ---- F2 (PRD 0016 F2a-F2e): per-user fixtures, outcomes in the DOM and in raw IDB. ----

const OFFLINE_TEXT = "You're offline. This page will load once you're back online.";

/** The raw persisted query cache (IDB `hc-query`) as JSON; 'null' when absent. */
function rawIdb(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const r = indexedDB.open('keyval-store');
        r.onsuccess = () => {
          const g = r.result.transaction('keyval').objectStore('keyval').get('hc-query');
          g.onsuccess = () => resolve(JSON.stringify(g.result ?? null));
        };
        r.onerror = () => resolve('null');
      }),
  );
}

/** Persisted queries still holding data, plus any marker found in the raw IDB value. [] = clean. */
async function leaks(page: Page, markers: string[]) {
  const raw = await rawIdb(page);
  const queries: { queryKey: unknown; state?: { data?: unknown } }[] = JSON.parse(raw)?.clientState?.queries ?? [];
  return [
    ...queries.filter((q) => q.state?.data != null).map((q) => `data: ${JSON.stringify(q.queryKey)}`),
    ...markers.filter((m) => raw.includes(m)).map((m) => `idb: ${m}`),
  ];
}

/** None of `markers` in the rendered DOM or the raw persisted cache. */
async function expectNoTrace(page: Page, markers: string[]) {
  const html = await page.content();
  const raw = await rawIdb(page);
  for (const m of markers) {
    expect(html, `DOM contains ${m}`).not.toContain(m);
    expect(raw, `IDB contains ${m}`).not.toContain(m);
  }
}

/** A fresh identity with a unique name and one owned set: its id, name and set title are the markers. */
async function persona(context: import('@playwright/test').BrowserContext, label: string) {
  const id = await asNewUser(context);
  const name = `${label}${id.slice(0, 8)}`;
  const set = `${label} Set ${id.slice(0, 8)}`;
  const res = await context.request.post('/api/test/tracker', {
    data: {
      seed: {
        profiles: [{ id, first_name: name, last_name: 'Tester', email_prefs: {}, wird_reminder_time: null }],
        annotation_sets: [{ id: `set-${id}`, user_id: id, name: set, created_at: new Date().toISOString() }],
      },
    },
  });
  expect(res.ok()).toBe(true);
  return { id, name, set, markers: [id, name, set] };
}

async function logout(page: Page) {
  if (!/\/settings/.test(page.url())) await page.goto('/settings');
  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('menuitem', { name: 'Log out' }).click();
  await expect(page).toHaveURL(/\/login/);
}

/** Visit /settings as the current user until its data and their `me` (name) are persisted. */
async function visitSettings(page: Page, name: string) {
  await page.goto('/settings');
  await expect.poll(() => persistedKeys(page)).toContain('["me","settings"]');
  await expect.poll(() => rawIdb(page)).toContain(name);
}

/** The account menu shows `name` (read from the persisted `me`). */
async function expectAccount(page: Page, name: string) {
  await page.getByRole('button', { name: 'Account' }).click();
  await expect(page.getByText(name)).toBeVisible();
}

test('F2a: an offline cold launch of a visited route shows the real chrome and cached data (D3, E2)', async ({ page, context }) => {
  guardConsole(page);
  const u = await persona(context, 'Cyra');
  await page.goto('/wird');
  await swReady(page);
  await visitSettings(page, u.name);

  await context.setOffline(true);
  const cold = await context.newPage();
  guardConsole(cold);
  const off = await cold.goto('/settings');
  expect(off?.fromServiceWorker()).toBe(true);
  await expect(cold).not.toHaveTitle(/Offline/);
  await expect(cold.locator('nav').first()).toBeVisible();
  await expectAccount(cold, u.name);
  await expect(cold.getByText(OFFLINE_TEXT)).toHaveCount(0);
  await context.setOffline(false);
});

test('F2b: after logout, offline and online relaunches show none of the prior data (E6)', async ({ page, context }) => {
  guardConsole(page);
  const a = await persona(context, 'Alma');
  await page.goto('/wird');
  await swReady(page);
  await visitSettings(page, a.name);

  await logout(page);
  await expect.poll(() => leaks(page, a.markers)).toEqual([]);

  await context.setOffline(true);
  const off = await context.newPage();
  guardConsole(off);
  expect((await off.goto('/settings'))?.fromServiceWorker()).toBe(true);
  await expect(off.getByText(OFFLINE_TEXT)).toBeVisible();
  await expectNoTrace(off, a.markers);
  await off.close();
  await context.setOffline(false);

  const on = await context.newPage();
  guardConsole(on);
  await on.goto('/settings');
  await expect(on).toHaveURL(/\/login\?next=%2Fsettings$/);
  await expectNoTrace(on, a.markers);
});

test("F2c: user A, logout, user B shows none of A's data, online and offline (E7)", async ({ page, context }) => {
  guardConsole(page);
  const a = await persona(context, 'Alma');
  await page.goto('/wird');
  await swReady(page);
  await visitSettings(page, a.name);
  await logout(page);

  const b = await persona(context, 'Badr');
  await visitSettings(page, b.name); // B's own `me` is persisted
  await expectNoTrace(page, a.markers);

  await context.setOffline(true);
  const cold = await context.newPage();
  guardConsole(cold);
  expect((await cold.goto('/settings'))?.fromServiceWorker()).toBe(true);
  await expectAccount(cold, b.name);
  await expectNoTrace(cold, a.markers);
  await context.setOffline(false);
});

test('F2d: an unvisited route offline shows the offline state, not a skeleton (D4, E4)', async ({ page, context }) => {
  guardConsole(page);
  await persona(context, 'Dina');
  await page.goto('/wird');
  await swReady(page);

  await context.setOffline(true);
  const cold = await context.newPage();
  guardConsole(cold);
  // A shell route whose data was never fetched: the shell, then the offline note.
  expect((await cold.goto('/shared'))?.fromServiceWorker()).toBe(true);
  await expect(cold.getByText(OFFLINE_TEXT)).toBeVisible();
  // A route with no shell at all: /offline.html.
  await cold.goto('/onboarding');
  await expect(cold).toHaveTitle(/Offline/);
  await context.setOffline(false);
});

test("F2e: a new build's SW purges old hc-shell-* caches with no reload loop (D5)", async ({ page }) => {
  guardConsole(page);
  await page.goto('/wird');
  await swReady(page);
  const build = await page.evaluate(async () => {
    await (await caches.open('hc-shell-old')).put('/old', new Response('old'));
    return (await caches.keys()).find((k) => k.startsWith('hc-shell-') && k !== 'hc-shell-old')!;
  });
  // Document loads, not framenavigated (which also counts same-document URL updates).
  let navs = 0;
  page.on('load', () => navs++);

  // "Deploy": a different build's SW takes over this page.
  await page.evaluate(() => navigator.serviceWorker.register('/sw.js?v=e2e-next'));
  // controllerchange fires as activation starts; the purge is the activate handler's work.
  await expect
    .poll(() => page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith('hc-shell-'))))
    .toEqual(['hc-shell-e2e-next']);
  expect(await page.evaluate(() => navigator.serviceWorker.controller?.scriptURL)).toMatch(/v=e2e-next$/);
  expect(navs).toBe(0);

  expect(build).not.toBe('hc-shell-e2e-next');

  // The next launch loads exactly once under the new SW (no version-mismatch reload loop).
  await page.reload();
  await expect(page).toHaveTitle(/wird/i);
  await expect(page.locator('nav').first()).toBeVisible();
  expect(navs).toBe(1);
});

test.describe('signed out', () => {
  // E2E auth cookie only; no sb-auth-token = no session for the mock client.
  test.use({ storageState: { cookies: [{ name: 'x-e2e-test', value: 'true', domain: 'localhost', path: '/', expires: -1, httpOnly: false, secure: false, sameSite: 'Lax' }], origins: [] } });

  test('a shell launch with no session redirects to /login?next= (E8)', async ({ page }) => {
    guardConsole(page);
    await page.goto('/login');
    await swReady(page);
    const res = await page.goto('/wird/manage');
    expect(res?.fromServiceWorker()).toBe(true);
    await expect(page).toHaveURL(/\/login\?next=%2Fwird%2Fmanage$/);
  });

  // A3 via the shell guard: under PLAYWRIGHT_TEST the proxy bypasses auth, so only the
  // SW-served shell path is observable here (the proxy path is the same next= contract).
  test('a signed-out /tracker/<id> redirects to /login?next=/tracker/<id> (A3)', async ({ page }) => {
    guardConsole(page);
    await page.goto('/login');
    await swReady(page);
    const res = await page.goto('/tracker/some-circle-id');
    expect(res?.fromServiceWorker()).toBe(true);
    await expect(page).toHaveURL(/\/login\?next=%2Ftracker%2Fsome-circle-id$/);
  });

  test('a signed-out /shared redirects to /login?next=/shared (A3, M7)', async ({ page }) => {
    guardConsole(page);
    await page.goto('/login');
    await swReady(page);
    const res = await page.goto('/shared');
    expect(res?.fromServiceWorker()).toBe(true);
    await expect(page).toHaveURL(/\/login\?next=%2Fshared$/);
  });

  test('a signed-out /settings redirects to /login?next=/settings (A3, M8)', async ({ page }) => {
    guardConsole(page);
    await page.goto('/login');
    await swReady(page);
    const res = await page.goto('/settings');
    expect(res?.fromServiceWorker()).toBe(true);
    await expect(page).toHaveURL(/\/login\?next=%2Fsettings$/);
  });
});

test('the launch intro plays once per tab, not on hard navigations', async ({ page }) => {
  guardConsole(page);
  await page.goto('/reader');
  await expect(page.locator('.splash')).toHaveCount(0, { timeout: 5000 }); // played, then unmounted
  await page.goto('/settings'); // full document load, like <a href> / location.assign
  await page.waitForLoadState('load');
  await expect(page.locator('.splash')).toBeHidden(); // stays display:none, never animates
});

test('a SW whose build is no longer deployed unregisters itself, so the app cannot pin an old build', async ({ page, context }) => {
  guardConsole(page);
  await page.goto('/wird');
  await swReady(page);
  // A newer deploy no longer serves this build's /_shell/<id>/ (seen by the SW's own fetch).
  await context.route('**/_shell/*/manifest.json', (route) => route.fulfill({ status: 404 }));
  await page.goto('/reader'); // shell-served navigation triggers the check
  // Shells dropped: the next navigation goes to the network (the live build), not a cached shell.
  await expect
    .poll(() =>
      page.evaluate(async () => {
        for (const k of await caches.keys())
          if (k.startsWith('hc-shell-') && (await (await caches.open(k)).keys()).some((r) => r.url.endsWith('/wird.html'))) return true;
        return false;
      }),
    )
    .toBe(false);
});

for (const installed of [true, false]) {
  test(`the notifications banner shows only in the installed app (installed: ${installed})`, async ({ page }) => {
    guardConsole(page);
    await page.addInitScript((installed) => {
      Object.defineProperty(Notification, 'permission', { get: () => 'default' });
      const mm = window.matchMedia.bind(window);
      window.matchMedia = (q: string) =>
        q === '(display-mode: standalone)' ? ({ ...mm(q), matches: installed } as MediaQueryList) : mm(q);
    }, installed);
    await page.goto('/wird');
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
    await expect(page.locator('.notify-banner')).toHaveCount(installed ? 1 : 0);
  });
}
