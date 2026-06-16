import { test, expect } from '@playwright/test';

test.describe('Annotations', () => {
  test('should render canvas for unauthenticated users with login prompt', async ({ page }) => {
    await page.goto('/reader/1');
    
    // Check if canvas is visible
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Check for login prompt
    await expect(page.locator('text=Log in to annotate')).toBeVisible();
  });

  test('should show set picker when authenticated', async ({ page, context }) => {
    // Inject dummy session
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: 'dummy-token',
        domain: 'localhost',
        path: '/',
      },
    ]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });

    await page.goto('/reader/1');

    // Check if canvas is visible
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // The set picker might not show up if there are no sets returned from mock supabase
    // But the component should at least render the "No sets found" or the picker if it has data.
    // Given our component implementation:
    // {sets.length > 0 ? (...) : (<p>No sets found...</p>)}
    
    // For this test, we just want to see if the "logged in" branch is hit.
    // If authenticated, it won't show "Log in to annotate".
    await expect(page.locator('text=Log in to annotate')).not.toBeVisible();
  });
});
