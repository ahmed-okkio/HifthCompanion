import { test, expect } from '@playwright/test';
import { SETS_ENABLED } from '../../lib/features';

// AGENTS.md: every test fails on a browser console error.
test.beforeEach(({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`);
  });
});

test.describe('Annotation Sets (Authenticated)', () => {
  test.skip(!SETS_ENABLED, 'sets are switched off (src/lib/features.ts)');

  test('footer is visible on the sets page (Story 19)', async ({ page, context }) => {
    await context.addCookies([
      { name: 'sb-access-token', value: 'dummy-token', domain: 'localhost', path: '/' },
    ]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });
    await page.goto('/sets');
    await page.waitForLoadState('networkidle');

    // Sets is a scrollable page; footer must be present and visible (selector: footer, role=contentinfo)
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    await expect(footer).toContainText('HifthCompanion');
  });

  test('should render sets page when authenticated', async ({ page, context }) => {
    // Setup a dummy session to simulate authentication
    // Note: In a real app, this would involve authenticating against Supabase
    // or injecting a valid session cookie.
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: 'dummy-token',
        domain: 'localhost',
        path: '/',
      },
    ]);

    // Go to sets page with e2e header
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });
    await page.goto('/sets');

    // Verify it renders the page content instead of redirecting
    await expect(page).toHaveURL(/.*sets/);
    await expect(page.locator('h1')).toContainText('My Annotation Sets');
  });
});

// PRD 0016 B1/B2/B4/B5: hidden [locale] segment — visible URL has no prefix, html lang/dir
// is right on first byte, and a cookie change applies on the next request. Asserts on raw
// server HTML: a browser load of the Arabic font trips CORS on the global x-e2e-test header.
test('locale cookie renders /sets in Arabic RTL with unprefixed URL', async ({ request }) => {
  const ar = await request.get('/sets', { headers: { cookie: 'locale=ar' } });
  expect(ar.url()).toMatch(/\/sets$/);
  const arHtml = await ar.text();
  expect(arHtml).toMatch(/<html[^>]*lang="ar"[^>]*dir="rtl"/);

  const en = await request.get('/sets', { headers: { cookie: 'locale=en' } });
  const enHtml = await en.text();
  expect(enHtml).toMatch(/<html[^>]*lang="en"[^>]*dir="ltr"/);
});

test('sets switched off: /sets redirects to the reader and no nav links to it', async ({ page, context }) => {
  test.skip(SETS_ENABLED, 'sets are switched on');
  await context.addCookies([{ name: 'sb-access-token', value: 'dummy-token', domain: 'localhost', path: '/' }]);
  await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });
  await page.goto('/sets');
  await expect(page).toHaveURL(/\/reader\/\d+/);
  await expect(page.locator('.upper-canvas')).toBeVisible();
  await expect(page.locator('a[href="/sets"]')).toHaveCount(0);
});
