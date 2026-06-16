import { test, expect } from '@playwright/test';

test.describe('Annotation Sets (Authenticated)', () => {
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
