import { test, expect } from '@playwright/test';

test('page jumper navigates to the typed page (not page 1)', async ({ page }) => {
  await page.goto('/reader/1');
  await expect(page.locator('.upper-canvas')).toBeVisible();
  // open the page jumper, type 5, Enter
  await page.locator('button[title="Click to jump to page"]').click();
  await page.locator('input[type="number"]').fill('5');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/reader\/5(\?|$)/);
});

test('next button increments page', async ({ page }) => {
  await page.goto('/reader/3');
  await expect(page.locator('.upper-canvas')).toBeVisible();
  await page.locator('button[title="Next page"]').click();
  await expect(page).toHaveURL(/\/reader\/4(\?|$)/);
});

test('desktop: mobile surah burger button is hidden', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/reader/1');
  await expect(page.locator('[data-testid="surah-panel"]')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('button[aria-label="Open surah list"]')).toBeHidden();
});
