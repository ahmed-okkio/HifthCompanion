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

    // The real scroll container is the inner list, not the overflow-hidden aside.
    const scrollList = page.locator('[data-testid="surah-scroll-list"]');
    await expect(scrollList).toBeVisible({ timeout: 10000 });

    // Scroll the list to a non-trivial offset and confirm it actually moved.
    await scrollList.evaluate((el) => { el.scrollTop = 400; });
    const before = await scrollList.evaluate((el) => el.scrollTop);
    expect(before).toBeGreaterThan(0);

    // Navigate via a surah that is fully in view at this offset (Al-A'raf), so the click
    // itself does not scroll the list — this isolates the restore behaviour we care about.
    await scrollList.getByRole('button', { name: /Al-A'raf/i }).click();
    await expect(page).toHaveURL(/\/reader\/151$/);

    // The panel does not remount across navigation; its scroll position must be preserved
    // (re-pinned past the page's post-nav reset), not snapped to 0 or to the current surah.
    await expect
      .poll(async () => scrollList.evaluate((el) => el.scrollTop), { timeout: 5000 })
      .toBeGreaterThanOrEqual(before - 4);

    // And it must stay put a moment later (guards against the late async reset winning).
    await page.waitForTimeout(700);
    const settled = await scrollList.evaluate((el) => el.scrollTop);
    expect(settled).toBeGreaterThanOrEqual(before - 4);
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

  test('soft page swap: prev/next, jump, and surah-select reuse the canvas (Story 24)', async ({ page }) => {
    listenForErrors(page);

    // Wait for the first canvas to be created + ready, then snapshot the create count.
    await expect(page.locator('[data-canvas-ready="true"]')).toBeVisible({ timeout: 10000 });
    const createdAfterFirst = await page.evaluate(() => (window as any).__hifthFabricCreatedCount);
    expect(createdAfterFirst).toBe(1);

    // Helper: assert the page changed (image swapped) but the Fabric instance was reused.
    const expectSoftSwap = async (expectUrl: RegExp) => {
      await expect(page).toHaveURL(expectUrl);
      await expect(page.locator('[data-canvas-ready="true"]')).toBeVisible({ timeout: 10000 });
      const created = await page.evaluate(() => (window as any).__hifthFabricCreatedCount);
      expect(created, 'Fabric instance must be reused, not recreated').toBe(createdAfterFirst);
    };

    // 1) Next page (ReaderNav prev/next).
    await page.locator('button[title="Next page"]').click();
    await expectSoftSwap(/\/reader\/2$/);

    // 2) Jump to an arbitrary page (page jumper input).
    await page.locator('button[title="Click to jump to page"]').click();
    await page.locator('input[type="number"]').fill('50');
    await page.locator('input[type="number"]').press('Enter');
    await expectSoftSwap(/\/reader\/50$/);

    // 3) Surah-select to a different page (surah panel).
    await page.getByRole('button', { name: /Al-Fatihah/i }).click();
    await expectSoftSwap(/\/reader\/1$/);

    // The page indicator reflects the final page — content genuinely changed throughout.
    await expect(page.locator('button[title="Click to jump to page"]')).toContainText('1');
  });

  test('surahs that start on the same page are combined into one active button', async ({ page }) => {
    listenForErrors(page);

    await page.goto('/reader/604');
    await page.waitForLoadState('networkidle');

    const panel = page.locator('[data-testid="surah-panel"]');
    const scrollList = page.locator('[data-testid="surah-scroll-list"]');
    await expect(panel).toBeVisible({ timeout: 10000 });

    const combinedButton = scrollList.locator('button')
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

  test('top nav stays at viewport top while surah list scrolls (Story 6)', async ({ page }) => {
    listenForErrors(page);

    // Scroll the surah list down so content moves
    const scrollList = page.locator('[data-testid="surah-scroll-list"]');
    await expect(scrollList).toBeVisible({ timeout: 10000 });
    await scrollList.evaluate((el) => { el.scrollTop = 500; });

    // Nav must remain at top of viewport (top === 0)
    const nav = page.locator('nav').first();
    const navBox = await nav.boundingBox();
    expect(navBox).not.toBeNull();
    if (navBox) {
      expect(navBox.y).toBeLessThanOrEqual(1); // ≤1px tolerance for subpixel
    }

    // Viewport must not have scrolled (document scrollTop stays 0)
    const docScrollTop = await page.evaluate(() => document.documentElement.scrollTop);
    expect(docScrollTop).toBe(0);
  });

  test('short window: toolbar, page, and panels all fit without clipping (Story 22)', async ({ page }) => {
    listenForErrors(page);

    // A deliberately short desktop viewport: the toolbar is taller than this height,
    // so before the fix its bottom controls clipped below the viewport.
    await page.setViewportSize({ width: 1280, height: 600 });
    await page.goto('/reader/1');
    await page.waitForLoadState('networkidle');

    const frame = page.locator('.page-display-frame');
    await expect(frame).toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(400); // let page-fit + sticky settle

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    const vh = viewport!.height;
    const tol = 2; // subpixel/scrollbar tolerance

    // Every key region's bounding box must stay within the locked viewport (no element
    // extends below the fold) — the toolbar, the Quran page, and the surah panel/list.
    const regions: Record<string, string> = {
      toolbar: 'aside.sticky',
      frame: '.page-display-frame',
      surahPanel: '[data-testid="surah-panel"]',
      surahList: '[data-testid="surah-scroll-list"]',
    };
    for (const [name, sel] of Object.entries(regions)) {
      const box = await page.locator(sel).first().boundingBox();
      expect(box, `${name} should render a box`).not.toBeNull();
      if (box) {
        expect(box.y, `${name} top within viewport`).toBeGreaterThanOrEqual(-tol);
        expect(box.y + box.height, `${name} bottom within viewport`).toBeLessThanOrEqual(vh + tol);
      }
    }

    // The page itself must not be cut off: its full height fits above the fold.
    const frameBox = await frame.boundingBox();
    expect(frameBox).not.toBeNull();
    if (frameBox) expect(frameBox.height).toBeGreaterThan(0);

    // The locked app-shell must not produce document-level scroll even when short.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollHeight - document.documentElement.clientHeight
    );
    expect(overflow).toBeLessThanOrEqual(tol);

    // The clipped bottom controls (Clear) must remain reachable inside the scrollable toolbar.
    const clear = page.locator('aside button[title="Clear all drawings"]');
    await expect(clear).toBeVisible();
    await clear.scrollIntoViewIfNeeded();
    const clearBox = await clear.boundingBox();
    expect(clearBox).not.toBeNull();
    if (clearBox) expect(clearBox.y + clearBox.height).toBeLessThanOrEqual(vh + tol);
  });

  test('footer is absent from desktop reader app-shell (Story 18/19)', async ({ page }) => {
    listenForErrors(page);

    // Desktop reader uses fixed app-shell; footer must be hidden (lg:hidden)
    const footer = page.locator('footer');
    // Footer element exists in DOM (rendered for mobile) but must not be visible at desktop width
    await expect(footer).not.toBeVisible();
  });

  test('Undo/Redo buttons are visible and large enough', async ({ page }) => {
    const undo = page.locator('aside button[title="Undo"]');
    const redo = page.locator('aside button[title="Redo"]');
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
    const red = page.locator('aside button[title="Red"]');
    await expect(red).toBeVisible();

    // At least 3 swatches present
    const swatches = page.locator('aside').locator('button[title]');
    const count = await swatches.count();
    expect(count).toBeGreaterThan(2);
  });
});
