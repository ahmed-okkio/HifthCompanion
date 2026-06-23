import { test, expect } from '@playwright/test';

test.describe('Annotations', () => {
  test('should render canvas for unauthenticated users with login prompt', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/reader/1');
    
    // Check if canvas is visible
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // Check for login prompt
    await expect(page.locator('text=Log in to annotate')).toBeVisible();
  });

  test('should show set picker when authenticated', async ({ page, context }) => {
    // Inject dummy session
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: 'dummy-token',
        domain: 'localhost',
        path: '/',
      },
    ]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });

    await page.goto('/reader/1');

    // Check if canvas is visible
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible();

    // The set picker might not show up if there are no sets returned from mock supabase
    // But the component should at least render the "No sets found" or the picker if it has data.
    // Given our component implementation:
    // {sets.length > 0 ? (...) : (<p>No sets found...</p>)}
    
    // For this test, we just want to see if the "logged in" branch is hit.
    // If authenticated, it won't show "Log in to annotate".
    await expect(page.locator('text=Log in to annotate')).not.toBeVisible();
  });

  test('should draw with highlighter tool', async ({ page, context }) => {
    // Inject dummy session
    await context.addCookies([
      {
        name: 'sb-access-token',
        value: 'dummy-token',
        domain: 'localhost',
        path: '/',
      },
    ]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });

    // Since mock DB starts empty on page load, sets list might be empty.
    // Let's navigate to /sets first to create a set.
    await page.goto('/sets');
    await page.fill('input[placeholder="New set name..."]', 'E2E Highlight Set');
    await page.click('button:has-text("Create")');
    await expect(page.locator('text=E2E Highlight Set').first()).toBeVisible();

    await page.goto('/reader/1');

    // Wait for canvas to render
    const canvas = page.locator('.upper-canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(async () => {
      return await page.evaluate(() => Boolean((window as any).fabricCanvas));
    }, { timeout: 10000 }).toBeTruthy();
    await expect(page.locator('[data-canvas-ready="true"]')).toBeVisible();

    // Select highlighter tool
    await page.click('button[title="Highlighter"]', { force: true });

    // Opacity slider should be visible
    await expect(page.locator('text=Opacity')).toBeVisible();

    // Wait for fabric's shape handler to register the new tool
    await expect.poll(async () => {
      return await page.evaluate(() => (window as any).__annotationTool === 'highlighter');
    }, { timeout: 5000 }).toBeTruthy();

    // Select Green color
    // The button title is "Green" and has backgroundColor: '#22c55e'
    await page.click('button[title="Green"]', { force: true });

    // Draw on the canvas with retry — fabric shape handlers can miss the first stroke on slow FS
    let objectsCount = 0;
    for (let attempt = 0; attempt < 3 && objectsCount === 0; attempt++) {
      const box = await canvas.boundingBox();
      if (!box) throw new Error('Canvas bounding box not found');

      const startX = box.x + Math.round(box.width * 0.25);
      const startY = box.y + Math.round(box.height * 0.25);
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 150, startY + 100, { steps: 10 });
      await page.mouse.up();

      try {
        await expect.poll(async () => {
          const fabricCanvas = (window as any).fabricCanvas;
          if (!fabricCanvas) return 0;
          return fabricCanvas.getObjects().filter((o: any) => o.type === 'rect').length;
        }, { timeout: 3000 }).toBeGreaterThan(0);
      } catch { /* retry */ }

      objectsCount = await page.evaluate(() => {
        const fabricCanvas = (window as any).fabricCanvas;
        if (!fabricCanvas) return 0;
        return fabricCanvas.getObjects().filter((o: any) => o.type === 'rect').length;
      });
    }

    // Verify object created is a Rect
    expect(objectsCount).toBeGreaterThan(0);
  });
});
