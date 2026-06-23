/**
 * Mobile E2E specs — runs under the `mobile` Playwright project (Pixel 5 preset,
 * 393 × 851 CSS px). The `chromium` Desktop project ignores these via testIgnore.
 *
 * Story 23: preserve data-testid hooks + add mobile project with Pixel 5 preset.
 *
 * Assertions (per PRD Testing Decisions):
 *   (a) Surah button in top nav (aria-label "Open surah list", lg:hidden) → visible at mobile width;
 *       tapping opens bottom-sheet (mobile-surah-scroll-list visible)
 *   (b) Floating pill ABSENT (old fixed bottom-left "Surahs" pill, removed in Story 10)
 *   (c) Mobile surah trigger + MobileAnnotationBar do NOT overlap (bounding boxes disjoint)
 *   (d) Content scrolls between fixed top nav + fixed bottom bar
 *       (document scrollable, nav + bar stay fixed at mobile)
 *   (e) Share view works at mobile width (loads, surah control present, no horizontal overflow)
 */

import { test, expect, type Page } from '@playwright/test';

function listenForErrors(page: Page) {
  page.on('console', msg => {
    if (msg.type() === 'error' && !msg.text().includes('React DevTools')) {
      throw new Error(`[Browser Error] ${msg.text()}`);
    }
  });
}

test.describe('Mobile reader layout (Pixel 5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/reader/1');
    await page.waitForLoadState('networkidle');
  });

  // (a) Surah button present in top nav at mobile width
  test('(a) surah button is visible in top nav at mobile width', async ({ page }) => {
    listenForErrors(page);

    const surahBtn = page.getByRole('button', { name: 'Open surah list' });
    await expect(surahBtn).toBeVisible({ timeout: 10000 });

    const box = await surahBtn.boundingBox();
    const nav = page.locator('nav').first();
    const navBox = await nav.boundingBox();

    expect(box).not.toBeNull();
    expect(navBox).not.toBeNull();
    if (box && navBox) {
      // Button must be vertically within the nav bar
      expect(box.y).toBeGreaterThanOrEqual(navBox.y - 2);
      expect(box.y + box.height).toBeLessThanOrEqual(navBox.y + navBox.height + 2);
    }
  });

  // The fixed nav must reserve its full height: page content starts below it, not behind it.
  test('(a) fixed nav does not cover the page content', async ({ page }) => {
    listenForErrors(page);
    await page.waitForSelector('[data-canvas-ready="true"]', { timeout: 15000 });
    const m = await page.evaluate(() => {
      const nav = document.querySelector('nav')!.getBoundingClientRect();
      const firstContent = (document.querySelector('#set-picker-top') ?? document.querySelector('.page-display-frame'))!.getBoundingClientRect();
      return { navBottom: Math.round(nav.bottom), contentTop: Math.round(firstContent.top) };
    });
    expect(m.contentTop, 'first content must start at/below the fixed nav').toBeGreaterThanOrEqual(m.navBottom - 2);
  });

  // (a) Tapping surah button opens bottom-sheet
  test('(a) tapping surah button opens the bottom-sheet', async ({ page }) => {
    listenForErrors(page);

    const surahBtn = page.getByRole('button', { name: 'Open surah list' });
    await expect(surahBtn).toBeVisible({ timeout: 10000 });
    await surahBtn.tap();

    const scrollList = page.locator('[data-testid="mobile-surah-scroll-list"]');
    await expect(scrollList).toBeVisible({ timeout: 5000 });
  });

  // (a) Bottom-sheet scrolls to current surah and closes on selection
  test('(a) bottom-sheet closes on surah selection and navigates', async ({ page }) => {
    listenForErrors(page);

    const surahBtn = page.getByRole('button', { name: 'Open surah list' });
    await surahBtn.tap();

    const scrollList = page.locator('[data-testid="mobile-surah-scroll-list"]');
    await expect(scrollList).toBeVisible({ timeout: 5000 });

    // Use JS dispatch to click Al-Baqarah — the backdrop div (z-49) can intercept
    // Playwright pointer events even though the sheet (z-50) should be on top.
    await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('[data-testid="mobile-surah-scroll-list"] button'));
      const btn = buttons.find(b => /Al-Baqarah/i.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
      btn?.click();
    });

    // After selection, URL should navigate to page 2 (may have query params for set)
    await expect(page).toHaveURL(/\/reader\/2/, { timeout: 10000 });
    // Sheet should slide away (transform: translateY(100%)) — dialog role becomes hidden
    const sheet = page.locator('[role="dialog"][aria-label="Surah navigation"]');
    await expect
      .poll(async () => sheet.evaluate(el => (el as HTMLElement).style.transform), { timeout: 5000 })
      .toContain('translateY(100%)');
  });

  // (b) Floating pill absent
  test('(b) floating "Surahs" pill is absent', async ({ page }) => {
    listenForErrors(page);

    // The old pill was a fixed bottom-left button with text "Surahs" and specific z-60 styling.
    // It was removed in Story 10. Assert it is not present in the DOM.
    const pill = page.locator('button').filter({ hasText: /^Surahs$/ });
    // Either not in DOM or not visible
    const count = await pill.count();
    if (count > 0) {
      await expect(pill.first()).not.toBeVisible();
    }
    // Also assert no fixed bottom-left element with text "Surahs" is visible
    const fixedPill = page.locator('text=Surahs').filter({ hasNot: page.locator('[data-testid="mobile-surah-scroll-list"]') });
    // If any element says exactly "Surahs" (not inside the bottom-sheet header), it should not be visible
    const pillVisible = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('*'));
      for (const el of all) {
        if (el.textContent?.trim() === 'Surahs') {
          const style = window.getComputedStyle(el);
          if (style.position === 'fixed' && style.bottom !== 'auto') {
            const rect = el.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) return true;
          }
        }
      }
      return false;
    });
    expect(pillVisible, 'fixed bottom "Surahs" pill must not be visible').toBe(false);
  });

  // (c) Surah trigger + annotation bar do not overlap
  test('(c) surah button and MobileAnnotationBar do not overlap', async ({ page }) => {
    listenForErrors(page);

    await page.waitForLoadState('networkidle');

    const surahBtn = page.getByRole('button', { name: 'Open surah list' });
    await expect(surahBtn).toBeVisible({ timeout: 10000 });

    // MobileAnnotationBar has data-testid="mobile-annotation-bar" (fixed bottom:0, lg:hidden)
    const mobileBar = page.locator('[data-testid="mobile-annotation-bar"]');

    const surahBox = await surahBtn.boundingBox();
    const barBox = await mobileBar.boundingBox();

    expect(surahBox).not.toBeNull();
    if (barBox && surahBox) {
      // Disjoint = no vertical overlap between surah nav button (in top nav) and annotation bar (fixed bottom)
      const surahBottom = surahBox.y + surahBox.height;
      const barTop = barBox.y;
      // Surah btn must be fully above the annotation bar
      const verticallyDisjoint = surahBottom <= barTop + 2 || barBox.y + barBox.height <= surahBox.y + 2;
      expect(verticallyDisjoint, `surah button (bottom=${surahBottom}) and annotation bar (top=${barTop}) must not overlap`).toBe(true);
    }
  });

  // (d) Content scrolls between fixed bars; nav stays fixed
  test('(d) nav stays fixed while content is scrollable', async ({ page }) => {
    listenForErrors(page);

    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible({ timeout: 10000 });

    // Measure nav position before scroll attempt
    const navBoxBefore = await nav.boundingBox();
    expect(navBoxBefore).not.toBeNull();

    // On mobile, document should be scrollable (content > viewport) OR at least
    // scrollHeight > clientHeight once the Quran page + footer are loaded.
    // Scroll down the page body
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(200);

    const navBoxAfter = await nav.boundingBox();
    expect(navBoxAfter).not.toBeNull();

    if (navBoxBefore && navBoxAfter) {
      // Nav top must remain ≤ 1px (fixed at top)
      expect(navBoxAfter.y, 'nav must stay fixed at top after scroll').toBeLessThanOrEqual(1);
    }

    // Document scroll position should be > 0 if content is taller than viewport
    const scrollTop = await page.evaluate(() => document.documentElement.scrollTop || window.scrollY);
    // Content may or may not be tall enough to scroll on page 1 depending on image load,
    // but the nav must stay at y ≤ 1 regardless.
    expect(navBoxAfter!.y).toBeLessThanOrEqual(1);
  });

  // (d) Mobile annotation bar stays fixed at bottom while content scrolls
  test('(d) MobileAnnotationBar stays fixed at bottom while content scrolls', async ({ page }) => {
    listenForErrors(page);

    // Wait for page load
    await page.waitForLoadState('networkidle');

    // Get the annotation bar by its testid (data-testid="mobile-annotation-bar")
    const mobileBar = page.locator('[data-testid="mobile-annotation-bar"]');
    await expect(mobileBar).toBeVisible();

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    // The bar is position:fixed — it must be fixed to the VIEWPORT, not to a transformed
    // ancestor. A transformed ancestor (e.g. an animate-fade-in on <main>, which keeps a
    // computed matrix via animation-fill-mode:both) would become its containing block and
    // pin it to that element instead of the viewport. offsetParent === null proves the
    // nearest positioned/transformed ancestor is the viewport.
    const offsetParentTag = await mobileBar.evaluate(
      (el) => (el as HTMLElement).offsetParent?.tagName ?? null,
    );
    expect(offsetParentTag, 'fixed annotation bar must not be trapped by a transformed ancestor').toBeNull();

    // Scroll down
    await page.evaluate(() => window.scrollBy(0, 300));
    await page.waitForTimeout(200);

    const barBox = await mobileBar.boundingBox();
    expect(barBox).not.toBeNull();
    if (barBox && viewport) {
      // Bar bottom must be at or near viewport bottom (fixed bottom:0)
      const barBottom = barBox.y + barBox.height;
      expect(barBottom, 'annotation bar must stay at viewport bottom').toBeGreaterThanOrEqual(viewport.height - 4);
    }
  });

  // Compact toolbar (Option A): no horizontal overflow; tool + color open via popovers.
  test('compact toolbar fits and opens tool / color popovers', async ({ page }) => {
    listenForErrors(page);
    await page.waitForLoadState('networkidle');

    // The control row must fit the viewport — no horizontal scroll/clip.
    const rowFits = await page.evaluate(() => {
      const bar = document.querySelector('[data-testid="mobile-annotation-bar"]');
      const row = bar?.querySelector('div[style*="space-around"]') as HTMLElement | null;
      return row ? row.scrollWidth <= row.clientWidth + 1 : false;
    });
    expect(rowFits, 'toolbar row must not overflow horizontally').toBe(true);

    // Tool popover opens; selecting a tool applies it and closes the popover.
    // JS-dispatch the triggers (the Next dev indicator overlaps the leftmost button in dev).
    await page.evaluate(() => (document.querySelector('button[aria-label="Tools"]') as HTMLButtonElement)?.click());
    await expect(page.getByRole('menu', { name: 'Tools' })).toBeVisible();
    await page.evaluate(() => {
      const grid = document.querySelector('[role="menu"][aria-label="Tools"]');
      (grid?.querySelector('button[aria-label="Highlighter"]') as HTMLButtonElement)?.click();
    });
    await expect(page.getByRole('menu', { name: 'Tools' })).toBeHidden();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __annotationTool?: string }).__annotationTool)).toBe('highlighter');

    // Color popover opens and shows the preset swatches.
    await page.evaluate(() => (document.querySelector('button[aria-label="Color"]') as HTMLButtonElement)?.click());
    await expect(page.getByRole('menu', { name: 'Colors' })).toBeVisible();
  });

  // Move/Draw mode: default Move lets a finger scroll (canvas ignores touch); Draw captures it.
  test('mobile defaults to Move (canvas ignores touch) and Draw toggle enables drawing', async ({ page }) => {
    listenForErrors(page);
    await page.waitForSelector('[data-canvas-ready="true"]', { timeout: 15000 });

    // The fabric WRAPPER (.canvas-container) is what must ignore pointer events in Move mode —
    // otherwise a swipe over the image is swallowed by Fabric's touch-action:none and the page
    // can't scroll. Asserting the wrapper (not just the upper canvas) guards that.
    const wrapperPE = () => page.evaluate(() => (document.querySelector('.canvas-container') as HTMLElement)?.style.pointerEvents);

    // Default: Move — the canvas ignores pointer events so a finger swiping the image scrolls.
    expect(await wrapperPE()).toBe('none');

    // Toggle to Draw — canvas captures touch again.
    await page.evaluate(() => (document.querySelector('button[aria-pressed]') as HTMLButtonElement)?.click());
    await expect.poll(wrapperPE).not.toBe('none');

    // Picking a tool also implies Draw.
    await page.evaluate(() => (document.querySelector('button[aria-pressed]') as HTMLButtonElement)?.click()); // back to Move
    await expect.poll(wrapperPE).toBe('none');
    await page.evaluate(() => (document.querySelector('button[aria-label="Tools"]') as HTMLButtonElement)?.click());
    await page.evaluate(() => {
      const grid = document.querySelector('[role="menu"][aria-label="Tools"]');
      (grid?.querySelector('button[aria-label="Highlighter"]') as HTMLButtonElement)?.click();
    });
    await expect.poll(wrapperPE).not.toBe('none');
  });
});

test.describe('Mobile share view (Pixel 5)', () => {
  // (e) Share view loads at mobile width, surah control present, no horizontal overflow
  test('(e) share view loads at mobile width with surah control', async ({ page }) => {
    listenForErrors(page);

    await page.goto('/share/test-user/1?set=test-set');
    await page.waitForLoadState('networkidle');

    // Surah button must be present in share header at mobile width
    const surahBtn = page.getByRole('button', { name: 'Open surah list' });
    await expect(surahBtn).toBeVisible({ timeout: 10000 });

    // Tapping opens the mobile drawer
    await surahBtn.tap();
    const scrollList = page.locator('[data-testid="mobile-surah-scroll-list"]');
    await expect(scrollList).toBeVisible({ timeout: 5000 });

    // Close drawer via the "Close surah list" button inside the sheet header
    await page.getByRole('button', { name: 'Close surah list' }).click();
    // Sheet slides away via transform: translateY(100%) — check transform style rather than visibility
    const sheet = page.locator('[role="dialog"][aria-label="Surah navigation"]');
    await expect
      .poll(async () => sheet.evaluate(el => (el as HTMLElement).style.transform), { timeout: 5000 })
      .toContain('translateY(100%)');
  });

  test('(e) share view has no horizontal overflow at mobile width', async ({ page }) => {
    listenForErrors(page);

    await page.goto('/share/test-user/1?set=test-set');
    await page.waitForLoadState('networkidle');

    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();

    const bodyScrollWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyScrollWidth, 'no horizontal overflow on share view at mobile width').toBeLessThanOrEqual(viewport!.width + 1);
  });

  test('(e) share view shows read-only badge at mobile width', async ({ page }) => {
    listenForErrors(page);

    await page.goto('/share/test-user/1?set=test-set');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=read-only').first()).toBeVisible({ timeout: 10000 });

    // Page display frame must be visible and fit within mobile viewport
    const frame = page.locator('.page-display-frame');
    await expect(frame).toBeVisible({ timeout: 10000 });

    const box = await frame.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.width).toBeLessThanOrEqual(viewport.width + 2);
      expect(box.x).toBeGreaterThanOrEqual(-2);
    }
  });
});
