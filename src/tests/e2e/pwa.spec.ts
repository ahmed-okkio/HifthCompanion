import { test, expect, type Page } from '@playwright/test';
import { seedShare } from './shareFixture';

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
  await page.goto('/settings');
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
});
