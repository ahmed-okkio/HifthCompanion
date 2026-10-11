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
