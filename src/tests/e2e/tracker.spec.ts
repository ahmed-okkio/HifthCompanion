import { test, expect } from '@playwright/test';

// Tracker M1 — teacher create + open flow against the mock Supabase client.
// One authenticated mock user (teacher of the halaqat they create).
test.describe('Progression Tracker (Authenticated)', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: 'sb-access-token', value: 'dummy-token', domain: 'localhost', path: '/' },
    ]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });
  });

  test('create a halaqah and open its teacher view', async ({ page }) => {
    // Fail on any browser console error (AGENTS.md strict error policy).
    page.on('console', (msg) => {
      if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`);
    });

    await page.goto('/tracker');
    await expect(page.locator('h1')).toContainText('Progress Tracker');

    const name = `Fajr Circle ${Date.now()}`;
    await page.getByPlaceholder('Create halaqah').fill(name);
    await page.getByRole('button', { name: 'Create halaqah' }).click();

    // Appears under "Halaqat I teach" as a card link.
    const card = page.getByRole('link', { name: new RegExp(name) });
    await expect(card).toBeVisible();

    // Open it → teacher view shows the invite code + roster.
    await card.click();
    await expect(page).toHaveURL(/\/tracker\/[^/]+$/);
    await expect(page.getByText('Invite code')).toBeVisible();
    await expect(page.getByText('Roster')).toBeVisible();
    await expect(page.getByText('No students yet')).toBeVisible();
  });

  test('language switcher flips to Arabic + RTL', async ({ page }) => {
    await page.goto('/tracker');
    await page.getByLabel('Language').selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });
});
