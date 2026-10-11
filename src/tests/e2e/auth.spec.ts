import { test, expect, type Page } from '@playwright/test';
import { asNewUser } from './e2eUser';

// Forgot-password flow against the mock Supabase client. The email round-trip
// (link -> /auth/callback code exchange) is Supabase's; these cover our pages.

function guardConsole(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`);
  });
}

test.beforeEach(({ page }) => guardConsole(page));

test('login links to forgot password, which confirms the reset email was sent', async ({ page, context }) => {
  await context.addCookies([{ name: 'x-e2e-test', value: 'true', domain: 'localhost', path: '/' }]);
  await page.goto('/login');
  await page.getByRole('link', { name: 'Forgot password?' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await page.getByRole('textbox', { name: 'you@example.com' }).fill('someone@example.com');
  await page.getByRole('button', { name: 'Send reset link' }).click();
  await expect(page.getByRole('status')).toHaveText(/reset link is on its way/);
});

test('reset password with a recovery session saves and lands in the app', async ({ page, context }) => {
  await asNewUser(context);
  await page.goto('/reset-password');
  await page.getByLabel('New password').fill('n3w-passw0rd');
  await page.getByRole('button', { name: 'Save password' }).click();
  await expect(page).toHaveURL(/\/reader/);
});

test('reset password without a session offers a new link', async ({ page, context }) => {
  await context.clearCookies(); // drop the storageState session
  await context.addCookies([{ name: 'x-e2e-test', value: 'true', domain: 'localhost', path: '/' }]);
  await page.goto('/reset-password');
  await expect(page.getByText('This reset link is invalid or has expired.')).toBeVisible();
  await page.getByRole('link', { name: 'Request a new link' }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
});
