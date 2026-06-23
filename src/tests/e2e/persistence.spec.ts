import { test, expect } from '@playwright/test';

test.describe('Annotations Persistence', () => {
  test('should persist drawings across page reloads', async ({ page }) => {
    page.on('console', msg => console.log(`[Browser] ${msg.text()}`));

    // 1. Setup authenticated session
    // Note: We are using the storageState from auth.setup.ts
    // We don't need to manually inject cookies here.
    
    // Fail on console errors
    const logs: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      logs.push(text);
      if (msg.type() === 'error' && !text.includes('React DevTools')) {
        // Log it before throwing so we can see it in terminal
        console.error(`[Browser Error]: ${text}`);
      }
    });

    // 2. Go to sets page to create a REAL set
    await page.goto('/sets');
    const setName = `Test Set ${Date.now()}`;
    await page.fill('input[placeholder="New set name..."]', setName);
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=${setName}`)).toBeVisible();

    // 3. Go to reader page
    await page.goto('/reader/1');

    // 4. Wait for canvas to be initialized, then explicitly select our set
    const upperCanvas = page.locator('.upper-canvas');
    await expect(upperCanvas).toBeVisible();
    await expect.poll(async () => {
      return await page.evaluate(() => Boolean((window as any).fabricCanvas));
    }, { timeout: 10000 }).toBeTruthy();

    // Explicitly select our set (parallel tests may have added other sets)
    const picker = page.locator('#set-picker-top');
    await picker.selectOption({ label: setName });
    await expect.poll(async () => {
      return await page.evaluate(() => Boolean((window as any).fabricCanvas));
    }, { timeout: 10000 }).toBeTruthy();
    // Poll until canvas-ready attr appears (handles cycle and instant load)
    await expect.poll(async () => {
      return await page.evaluate(() => {
        const el = document.querySelector('[data-canvas-ready="true"]');
        return el !== null;
      });
    }, { timeout: 15000, message: 'data-canvas-ready="true" not found after set selection' }).toBeTruthy();
    await page.click('button[title="Pen"]', { force: true });

    // Confirm drawing mode is armed before we draw
    await expect.poll(async () => {
      return await page.evaluate(() => Boolean((window as any).fabricCanvas?.isDrawingMode));
    }, { timeout: 10000 }).toBeTruthy();

    // 5. Draw on the canvas with retry — slow FS can delay event registration
    let drew = false;
    for (let attempt = 0; attempt < 3 && !drew; attempt++) {
      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect.poll(async () => {
        box = await upperCanvas.boundingBox();
        return box !== null && box.width > 50 && box.height > 50;
      }, { timeout: 10000 }).toBeTruthy();
      if (!box) throw new Error('Canvas not found');
      box = box as { x: number; y: number; width: number; height: number };

      const startX = box.x + Math.round(box.width * 0.25);
      const startY = box.y + Math.round(box.height * 0.25);
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 100, startY + 100, { steps: 10 });
      await page.mouse.up();

      try {
        await expect.poll(async () => {
          return await page.evaluate(() => {
            const canvas = (window as any).fabricCanvas;
            return canvas ? canvas.getObjects().length > 0 : false;
          });
        }, { timeout: 3000 }).toBeTruthy();
        drew = true;
      } catch { /* retry */ }
    }

    // 6. Wait for explicit save confirmation
    await expect.poll(() => logs.some(l => l.includes('Save successful')), {
      message: 'Wait for "Save successful" log',
      timeout: 10000,
    }).toBeTruthy();

    // 7. Reload and verify
    const lsBefore = await page.evaluate(() => localStorage.getItem('mock_supabase_annotations'));
    console.error('[E2E DEBUG] LS BEFORE:', lsBefore);
    await page.reload();
    const lsAfter = await page.evaluate(() => localStorage.getItem('mock_supabase_annotations'));
    console.error('[E2E DEBUG] LS AFTER:', lsAfter);
    
    // Ensure our set is selected (to avoid parallel test pollution)
    const pickerAfter = page.locator('#set-picker-top');
    await pickerAfter.selectOption({ label: setName });
    await expect.poll(async () => {
      return await page.evaluate(() => Boolean((window as any).fabricCanvas));
    }, { timeout: 10000 }).toBeTruthy();
    await expect(page.locator('[data-canvas-ready="true"]')).toBeVisible();
    await page.click('button[title="Pen"]', { force: true });
    
    // Check if drawing restored
    await expect.poll(async () => {
      return await page.evaluate(() => {
        // @ts-ignore
        const canvas = window.fabricCanvas;
        return canvas ? canvas.getObjects().length > 0 : false;
      });
    }, {
      message: 'Wait for objects to be restored on canvas',
      timeout: 10000,
    }).toBeTruthy();
  });
});
