import { test, expect, type Page } from '@playwright/test';

function listenForErrors(page: Page) {
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('React DevTools')) {
      throw new Error(`[Browser Error] ${msg.text()}`);
    }
  });
}

test.describe('Surah panel and toolbar layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reader/1');
    await page.waitForLoadState('networkidle');
  });

  test('clicking a surah navigates on the first click', async ({ page }) => {
    listenForErrors(page);

    await page.getByRole('button', { name: /Al-Baqarah/i }).click();

    await expect(page).toHaveURL(/\/reader\/2$/);
    await expect(page.locator('.upper-canvas')).toBeVisible();
  });

  test('surah panel keeps its scroll position after navigation', async ({ page }) => {
    listenForErrors(page);

    const panel = page.locator('[data-testid="surah-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    await panel.evaluate((el) => {
      el.scrollTop = 400;
    });

    const before = await panel.evaluate((el) => el.scrollTop);
    await page.getByRole('button', { name: /Al-Baqarah/i }).click();

    await expect(page).toHaveURL(/\/reader\/2$/);

    const after = await panel.evaluate((el) => el.scrollTop);
    expect(after).toBeGreaterThanOrEqual(before - 4);
  });

  test('clicking a surah on the current reader page does not remount the canvas', async ({ page }) => {
    listenForErrors(page);

    await expect(page.locator('[data-canvas-ready="true"]')).toBeVisible({ timeout: 10000 });

    await page.evaluate(() => {
      const canvas = (window as any).fabricCanvas;
      if (!canvas) {
        throw new Error('Fabric canvas was not exposed');
      }

      canvas.__surahPanelSentinel = 'preserve-current-page-canvas';
    });

    await page.getByRole('button', { name: /Al-Fatihah/i }).click();

    await expect(page).toHaveURL(/\/reader\/1$/);
    await expect.poll(async () => page.evaluate(() => {
      return (window as any).fabricCanvas?.__surahPanelSentinel;
    })).toBe('preserve-current-page-canvas');
  });

  test('surahs that start on the same page are combined into one active button', async ({ page }) => {
    listenForErrors(page);

    await page.goto('/reader/604');
    await page.waitForLoadState('networkidle');

    const panel = page.locator('[data-testid="surah-panel"]');
    const scrollList = page.locator('[data-testid="surah-scroll-list"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    const combinedButton = page.locator('button')
      .filter({ hasText: 'Al-Ikhlas' })
      .filter({ hasText: 'Al-Falaq' })
      .filter({ hasText: 'An-Nas' });
    await expect(combinedButton).toBeVisible();
    await expect(combinedButton).toContainText('112');
    await expect(combinedButton).toContainText('113');
    await expect(combinedButton).toContainText('114');
    await expect(combinedButton).toHaveCount(1);

    await expect.poll(async () => scrollList.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
    await expect(combinedButton).toHaveClass(/bg-emerald-50/);
  });

  test('surah navigation preserves the selected annotation set', async ({ page, context }) => {
    listenForErrors(page);

    await context.addCookies([{ name: 'sb-access-token', value: 'dummy-token', domain: 'localhost', path: '/' }]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });

    await page.goto('/sets');
    const setA = `Set-A-${Date.now()}`;
    const setB = `Set-B-${Date.now()}`;

    await page.fill('input[placeholder="New set name..."]', setA);
    await page.keyboard.press('Enter');
    await expect(page.locator(`text=${setA}`)).toBeVisible();
    await page.fill('input[placeholder="New set name..."]', setB);
    await page.keyboard.press('Enter');
    await expect(page.locator(`text=${setB}`)).toBeVisible();

    await page.goto('/reader/1');
    await expect(page.locator('.upper-canvas')).toBeVisible();
    await page.locator('#set-picker-top').selectOption({ label: setB });
    await expect(page).toHaveURL(/\/reader\/1\?set=/);

    await page.getByRole('button', { name: /Al-Baqarah/i }).click();

    await expect(page).toHaveURL(/\/reader\/2\?set=/);
    await expect(page.locator('#set-picker-top')).toContainText(setB);
  });

  test('Surah panel is visible and flush to the left', async ({ page }) => {
    const panel = page.locator('[data-testid="surah-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    // take a debug screenshot for verification
    await page.screenshot({ path: 'test-results/surah-panel-debug.png', fullPage: false });

    const box = await panel.boundingBox();
    // Allow small offset; assert that the panel's left edge is near the viewport left (<= 8px)
    expect(box).not.toBeNull();
    if (box) {
      expect(box.x).toBeLessThanOrEqual(8);
    }
  });

  test('share page shows the surah panel and navigates within the shared route', async ({ page }) => {
    listenForErrors(page);

    await page.goto('/share/test-user/1?set=test-set');
    await page.waitForLoadState('networkidle');

    const panel = page.locator('[data-testid="surah-panel"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: /Al-Baqarah/i }).click();

    await expect(page).toHaveURL(/\/share\/test-user\/2\?set=test-set$/);
  });

  test('reader page display is centered in the viewport', async ({ page }) => {
    listenForErrors(page);

    const frame = page.locator('.page-display-frame');
    await expect(frame).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: 'test-results/reader-centered-debug.png', fullPage: false });

    const box = await frame.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();

    if (box && viewport) {
      const frameCenter = box.x + box.width / 2;
      const viewportCenter = viewport.width / 2;
      expect(Math.abs(frameCenter - viewportCenter)).toBeLessThan(140);
    }
  });

  test('Undo/Redo buttons are visible and large enough', async ({ page }) => {
    const undo = page.locator('button[title="Undo"]');
    const redo = page.locator('button[title="Redo"]');
    await expect(undo).toBeVisible();
    await expect(redo).toBeVisible();

    const uBox = await undo.boundingBox();
    const rBox = await redo.boundingBox();
    expect(uBox).not.toBeNull();
    expect(rBox).not.toBeNull();
    if (uBox && rBox) {
      // ensure the icons/buttons are at least ~36px in width/height
      expect(uBox.width).toBeGreaterThanOrEqual(36);
      expect(uBox.height).toBeGreaterThanOrEqual(36);
      expect(rBox.width).toBeGreaterThanOrEqual(36);
      expect(rBox.height).toBeGreaterThanOrEqual(36);
    }
  });

  test('Color swatches are visible in the vertical toolbar', async ({ page }) => {
    // Red swatch exists
    const red = page.locator('button[title="Red"]');
    await expect(red).toBeVisible();

    // At least 3 swatches present
    const swatches = page.locator('aside').locator('button[title]');
    const count = await swatches.count();
    expect(count).toBeGreaterThan(2);
  });
});
