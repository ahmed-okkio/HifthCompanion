import { test, expect, type Page } from '@playwright/test';
import { seedShare } from './shareFixture';

// PRD 0016 M7: /share/<id>/<page> and /shared read client-side behind static shells.

function guardConsole(page: Page, allow?: RegExp) {
  page.on('console', (msg) => {
    if (msg.type() === 'error' && !(allow && allow.test(msg.text()))) throw new Error(`console error: ${msg.text()}`);
  });
}

test('a collaborator edits the shared set; page turns keep the canvas and the visible URL', async ({ page }) => {
  guardConsole(page);
  const { id, name } = await seedShare(page.request, 'collaborator');
  await page.goto(`/share/${id}`);
  await expect(page).toHaveURL(new RegExp(`/share/${id}/\\d+$`));
  await page.goto(`/share/${id}/5`);
  await expect(page.getByText(name)).toBeVisible();
  await expect(page.locator('[title="Click to jump to page"]')).toHaveText('5');
  await expect(page.locator('.upper-canvas')).toBeVisible();
  await expect(page.getByPlaceholder('Write a note…')).toBeVisible();

  await page.evaluate(() => ((window as unknown as { __noReload: boolean }).__noReload = true));
  const next = page.locator('button[aria-label="Next page"]:visible');
  const box = (await next.boundingBox())!;
  await next.click({ position: { x: box.width - 10, y: box.height / 2 } });
  await expect(page).toHaveURL(new RegExp(`/share/${id}/6$`));
  await expect(page.locator('[title="Click to jump to page"]')).toHaveText('6');
  await expect(page.getByText(name)).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __noReload?: boolean }).__noReload)).toBe(true);
});

test('an offline note write on share shows the offline error and is not applied (E10)', async ({ page, context }) => {
  // The refusal is logged by useNotes; offline fetch failures are expected.
  guardConsole(page, /You're offline|ERR_INTERNET_DISCONNECTED|Failed to load resource|Failed to fetch/);
  const { id } = await seedShare(page.request, 'collaborator');
  await page.goto(`/share/${id}/3`);
  const box = page.getByPlaceholder('Write a note…');
  await expect(box).toBeVisible();
  await expect(page.getByText('No notes yet.')).toBeVisible();

  await context.setOffline(true);
  await box.fill('offline note');
  await page.getByRole('button', { name: 'Add Note' }).click();
  await expect(page.getByText("You're offline. This change was not saved.")).toBeVisible();
  await expect(page.getByText('No notes yet.')).toBeVisible(); // rolled back
  await expect(box).toHaveValue('offline note'); // draft given back
  await context.setOffline(false);
});

test('[SEC] a user without access sees not found, not the set (C3)', async ({ page }) => {
  guardConsole(page, /404|Failed to load resource/);
  // Owned by another user, never shared with the mock user.
  const { id, name } = await seedShare(page.request, 'private');
  await page.goto(`/share/${id}/1`);
  await expect(page.getByText(/not found|404/i).first()).toBeVisible();
  await expect(page.getByText(name)).toHaveCount(0);
  await expect(page.locator('.upper-canvas')).toHaveCount(0);
  await expect(page.getByPlaceholder('Write a note…')).toHaveCount(0);
});

test('/shared lists sets shared with me, linking to the share route', async ({ page }) => {
  guardConsole(page);
  const { id, name } = await seedShare(page.request, 'collaborator');
  const hidden = await seedShare(page.request, 'private');
  await page.goto('/shared');
  const row = page.locator(`a[href="/share/${id}"]`);
  await expect(row).toContainText(name);
  await expect(page.getByText(hidden.name)).toHaveCount(0);
  await row.click();
  await expect(page).toHaveURL(new RegExp(`/share/${id}/\\d+$`));
  await expect(page.getByText(name)).toBeVisible();
});
