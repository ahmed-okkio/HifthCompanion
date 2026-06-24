import { test, expect, type Page } from '@playwright/test';

function listenForErrors(page: Page) {
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('React DevTools')) {
      throw new Error(`[Browser Error] ${msg.text()}`);
    }
  });
}

// Helper: create a set and navigate to the reader (mirrors features.spec.ts pattern).
async function setupAuthenticatedReader(page: Page, setName: string) {
  await page.goto('/sets');
  await page.fill('input[placeholder="New set name..."]', setName);
  await page.click('button:has-text("Create")');
  await expect(page.locator(`text=${setName}`)).toBeVisible();
  await page.goto('/reader/1');
  await expect(page.locator('.upper-canvas')).toBeVisible();
  await expect(page.locator('[data-canvas-ready="true"]')).toBeVisible();
  await page.locator('#set-picker-top').selectOption({ label: setName });
  await expect.poll(async () => {
    return page.evaluate(() => document.querySelector('[data-canvas-ready="true"]') !== null);
  }, { timeout: 15000, message: 'data-canvas-ready="true" not found after set selection' }).toBeTruthy();
}

test.describe('Surah panel and toolbar layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reader/1');
    await page.waitForLoadState('networkidle');
  });

  test('desktop shell shows three regions: icon rail, surah panel, context panel (Story 3)', async ({ page }) => {
    await expect(page.locator('[data-testid="nav-rail-slot"]')).toBeVisible();
    await expect(page.locator('[data-testid="surah-panel"]')).toBeVisible();
    await expect(page.locator('[data-testid="context-panel"]')).toBeVisible();

    // Left-to-right order: icon rail, then surah panel, then context panel.
    const rail = await page.locator('[data-testid="nav-rail-slot"]').boundingBox();
    const surah = await page.locator('[data-testid="surah-panel"]').boundingBox();
    const ctx = await page.locator('[data-testid="context-panel"]').boundingBox();
    expect(rail && surah && ctx).toBeTruthy();
    if (rail && surah && ctx) {
      expect(rail.x).toBeLessThan(surah.x);
      expect(surah.x).toBeLessThan(ctx.x);
      // Context panel is a fixed-width right column (~320px).
      expect(Math.round(ctx.width)).toBe(320);
    }
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
    // Selected state is now token-driven inline style (Story 5): green-soft bg + green left border.
    await expect
      .poll(async () => combinedButton.evaluate((el) => getComputedStyle(el).borderLeftWidth))
      .toBe('4px');
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

    // Story 3: the left navigation REGION now leads with a 72px icon rail; the surah panel
    // sits immediately to its right (after the 24px app gutter). Assert the icon-rail slot
    // hugs the viewport left, and the surah panel follows directly after the rail — i.e. the
    // navigation region is left-anchored, not floating mid-workspace.
    const rail = page.locator('[data-testid="nav-rail-slot"]');
    await expect(rail).toBeVisible();
    const railBox = await rail.boundingBox();
    const box = await panel.boundingBox();
    expect(railBox).not.toBeNull();
    expect(box).not.toBeNull();
    if (railBox && box) {
      // Icon rail anchored at the left within the 24px app gutter (not floating mid-workspace).
      expect(railBox.x).toBeLessThanOrEqual(24 + 2);
      // Surah panel begins right where the 72px rail ends (no gap, small tolerance).
      expect(Math.abs(box.x - (railBox.x + railBox.width))).toBeLessThanOrEqual(8);
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

// Story 17 — V3 shell structure assertions (chromium / desktop only).
// Light structural guards: three regions present, icon rail visible,
// context panel present, right-panel cards render with a set active,
// and the inert zoom-control is rendered below the page.
test.describe('V3 shell structure (Story 17)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reader/1');
    await page.waitForLoadState('networkidle');
  });

  test('icon rail (nav-rail) is visible at desktop width', async ({ page }) => {
    listenForErrors(page);
    // nav-rail is the canonical testid inside NavRail; nav-rail-slot is the outer
    // wrapper in ReaderShell — both must be present at desktop width (lg:flex).
    await expect(page.locator('[data-testid="nav-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="nav-rail-slot"]')).toBeVisible();
  });

  test('context panel is present (in DOM) at desktop width', async ({ page }) => {
    listenForErrors(page);
    // context-panel is always in the DOM; at desktop it becomes a 320px flex column.
    const panel = page.locator('[data-testid="context-panel"]');
    await expect(panel).toBeAttached();
    const box = await panel.boundingBox();
    expect(box, 'context-panel must have a bounding box at desktop').not.toBeNull();
    if (box) {
      // Right column is ~320px wide at desktop.
      expect(box.width).toBeGreaterThanOrEqual(300);
    }
  });

  test('three regions present: icon rail, surah panel, context panel', async ({ page }) => {
    listenForErrors(page);
    // All three landmark regions are visible and left-to-right ordered.
    await expect(page.locator('[data-testid="nav-rail"]')).toBeVisible();
    await expect(page.locator('[data-testid="surah-panel"]')).toBeVisible();

    const railBox = await page.locator('[data-testid="nav-rail"]').boundingBox();
    const surahBox = await page.locator('[data-testid="surah-panel"]').boundingBox();
    const ctxBox = await page.locator('[data-testid="context-panel"]').boundingBox();

    expect(railBox).not.toBeNull();
    expect(surahBox).not.toBeNull();
    expect(ctxBox).not.toBeNull();

    if (railBox && surahBox && ctxBox) {
      // Left-to-right order: rail < surah panel < context panel.
      expect(railBox.x).toBeLessThan(surahBox.x);
      expect(surahBox.x).toBeLessThan(ctxBox.x);
    }
  });

  test('zoom-control is present in the DOM at desktop width', async ({ page }) => {
    listenForErrors(page);
    // zoom-control is an inert placeholder rendered inside AnnotationCanvas
    // (hidden on mobile via hidden lg:flex — so it must be attached at desktop).
    const zoom = page.locator('[data-testid="zoom-control"]');
    await expect(zoom).toBeAttached();
  });

  test('right-panel cards (notes-card, share-card, tags-card) render when a set is active', async ({ page, context }) => {
    listenForErrors(page);
    // Use the same auth/set pattern as features.spec.ts.
    await context.addCookies([{ name: 'sb-access-token', value: 'dummy-token', domain: 'localhost', path: '/' }]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });
    const setName = `Shell17-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    // All three right-panel cards must be present in the DOM (context panel renders them).
    await expect(page.getByTestId('notes-card')).toBeAttached();
    await expect(page.getByTestId('share-card')).toBeAttached();
    await expect(page.getByTestId('tags-card')).toBeAttached();
  });
});
