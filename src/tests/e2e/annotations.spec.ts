import { test, expect } from '@playwright/test';
import { seedSet } from './e2eUser';

// AGENTS.md: every test fails on a browser console error.
test.beforeEach(({ page }) => {
  page.on('console', (msg) => {
    if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`);
  });
});

test.describe('Annotations', () => {
  test('should render canvas for unauthenticated users with login prompt', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/reader/1');
    
    // Check if canvas is visible
    const canvas = page.locator('.upper-canvas');
    await expect(canvas).toBeVisible();

    // Check for login prompt
    await expect(page.locator('text=Sign in to annotate')).toBeVisible();
  });

  test('should show the signed-in reader when authenticated', async ({ page, context }) => {
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
    const canvas = page.locator('.upper-canvas');
    await expect(canvas).toBeVisible();

    // The set picker might not show up if there are no sets returned from mock supabase
    // But the component should at least render the "No sets found" or the picker if it has data.
    // Given our component implementation:
    // {sets.length > 0 ? (...) : (<p>No sets found...</p>)}
    
    // For this test, we just want to see if the "logged in" branch is hit.
    // If authenticated, it won't show "Sign in to annotate".
    await expect(page.locator('text=Sign in to annotate')).not.toBeVisible();
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

    const setId = await seedSet(page.request, 'E2E Highlight Set');
    await page.goto(`/reader/1?set=${setId}`);

    // Wait for canvas to render
    const canvas = page.locator('.upper-canvas');
    await expect(canvas).toBeVisible();
    await expect.poll(async () => {
      return await page.evaluate(() => Boolean(window.fabricCanvas));
    }, { timeout: 10000 }).toBeTruthy();
    await expect(page.locator('[data-canvas-ready="true"]')).toBeVisible();

    // Select highlighter tool
    await page.click('button[title="Highlighter"]', { force: true });

    // Opacity slider should be visible
    await expect(page.locator('text=Opacity')).toBeVisible();

    // Wait for fabric's shape handler to register the new tool
    await expect.poll(async () => {
      return await page.evaluate(() => window.__annotationTool === 'highlighter');
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

      const count = () => page.evaluate(() => {
        const fabricCanvas = window.fabricCanvas;
        if (!fabricCanvas) return 0;
        return fabricCanvas.getObjects().filter((o) => o.type === 'path').length;
      });
      try {
        await expect.poll(count, { timeout: 3000 }).toBeGreaterThan(0);
      } catch { /* retry */ }
      objectsCount = await count();
    }

    // Verify a highlighter stroke (free-drawing path) was created
    expect(objectsCount).toBeGreaterThan(0);
  });
});
