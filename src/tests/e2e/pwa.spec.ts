import { test, expect, type Page } from '@playwright/test';

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
});
