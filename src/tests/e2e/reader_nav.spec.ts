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

// Page-fit guard: the canvas must fill its frame (no "too small" gap) and the page must not
// clip, on every page regardless of that page image's intrinsic dimensions.
test('desktop: page fills its frame and the reader does not scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 800 });
  for (const p of [1, 100, 300]) {
    await page.goto(`/reader/${p}`);
    await page.waitForSelector('[data-canvas-ready="true"]', { timeout: 15000 });
    const m = await page.evaluate(() => {
      const frame = document.querySelector('.page-display-frame') as HTMLElement | null;
      const canvas = (document.querySelector('canvas.lower-canvas') ?? document.querySelector('canvas')) as HTMLCanvasElement | null;
      const fr = frame?.getBoundingClientRect();
      const cr = canvas?.getBoundingClientRect();
      const se = document.scrollingElement;
      return {
        frameH: fr ? Math.round(fr.height) : 0,
        canvasH: cr ? Math.round(cr.height) : 0,
        canvasW: cr ? Math.round(cr.width) : 0,
        docOverflow: se ? se.scrollHeight - se.clientHeight : 0,
        vh: window.innerHeight,
      };
    });
    // Canvas fills the frame height (≤ frame border ~10px); page is a real size, not collapsed.
    expect(Math.abs(m.frameH - m.canvasH), `p${p} canvas should fill frame`).toBeLessThanOrEqual(10);
    expect(m.canvasW, `p${p} canvas not collapsed`).toBeGreaterThan(200);
    // Page fits the viewport height (no document scroll on the fixed desktop app-shell).
    expect(m.docOverflow, `p${p} desktop must not scroll`).toBeLessThanOrEqual(1);
    expect(m.canvasH, `p${p} page fits viewport height`).toBeLessThanOrEqual(m.vh);
  }
});

test('mobile: page is not clipped (frame wraps the full canvas)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const p of [1, 100, 300]) {
    await page.goto(`/reader/${p}`);
    await page.waitForSelector('[data-canvas-ready="true"]', { timeout: 15000 });
    const m = await page.evaluate(() => {
      const frame = document.querySelector('.page-display-frame') as HTMLElement | null;
      const canvas = (document.querySelector('canvas.lower-canvas') ?? document.querySelector('canvas')) as HTMLCanvasElement | null;
      const fr = frame?.getBoundingClientRect();
      const cr = canvas?.getBoundingClientRect();
      return {
        frameH: fr ? Math.round(fr.height) : 0,
        canvasH: cr ? Math.round(cr.height) : 0,
        canvasW: cr ? Math.round(cr.width) : 0,
      };
    });
    // Frame height tracks the canvas (no maxHeight cap clipping a tall mobile page).
    expect(Math.abs(m.frameH - m.canvasH), `p${p} frame must wrap canvas (no clip)`).toBeLessThanOrEqual(10);
    expect(m.canvasW, `p${p} canvas fills column width`).toBeGreaterThan(300);
  }
});
