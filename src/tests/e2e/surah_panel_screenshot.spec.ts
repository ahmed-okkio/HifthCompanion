import { test, expect } from '@playwright/test';

// AGENTS.md: every test fails on a browser console error.
test.beforeEach(({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`);
  });
});

test('desktop screenshot of surah panel', async ({ page }) => {
  // ensure desktop viewport
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.goto('/reader/1');
  await page.waitForLoadState('networkidle');

  const panel = page.locator('[data-testid="surah-panel"]');
  await expect(panel).toBeVisible({ timeout: 5000 });

  // capture full-page desktop screenshot
  await page.screenshot({ path: 'test-results/surah-panel-full-desktop.png', fullPage: true });
});
