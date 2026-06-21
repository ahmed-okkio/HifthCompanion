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

    // 4. Wait for canvas to be initialized and set selected
    const upperCanvas = page.locator('.upper-canvas');
    await expect(upperCanvas).toBeVisible();
    
    // Verify our new set is selected
    const picker = page.locator('#set-picker-top');
    await expect(picker).toContainText(setName);
    await expect.poll(async () => {
      return await page.evaluate(() => Boolean((window as any).fabricCanvas));
    }, { timeout: 10000 }).toBeTruthy();
    await expect(page.locator('[data-canvas-ready="true"]')).toBeVisible();
    await page.click('button[title="Pen"]', { force: true });

    // 5. Draw on the canvas
    const box = await upperCanvas.boundingBox();
    if (!box) throw new Error('Canvas not found');
    
    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });
    await page.mouse.up();

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
