import { test, expect, Page } from '@playwright/test';

// Helper: fail on meaningful browser console errors.
// Excludes React DevTools noise and network resource errors (which are emitted
// as console errors but represent failed fetches — not JS exceptions — and can
// appear on share/unauthenticated pages for expected auth-related requests).
function listenForErrors(page: Page) {
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (text.includes('React DevTools')) return;
    if (text.includes('Failed to load resource')) return;
    throw new Error(`[Browser Error] ${text}`);
  });
}

// Helper: create a set and go to reader
async function setupAuthenticatedReader(page: Page, setName: string) {
  await page.goto('/sets');
  await page.fill('input[placeholder="New set name..."]', setName);
  await page.click('button:has-text("Create")');
  await expect(page.locator(`text=${setName}`)).toBeVisible();
  await page.goto('/reader/1');
  await expect(page.locator('.upper-canvas')).toBeVisible();
  await expect(page.locator('[data-canvas-ready="true"]')).toBeVisible();
  // Ensure our set is selected in the picker.
  // selectOption triggers loadAnnotation which may cycle canvasReady false→true.
  // We poll for canvasReady via the data attr, then confirm fabricCanvas + isDrawingMode.
  await page.locator('#set-picker-top').selectOption({ label: setName });
  // Poll until canvas-ready attr appears (handles both the cycle case and the instant case)
  await expect.poll(async () => {
    return await page.evaluate(() => {
      const el = document.querySelector('[data-canvas-ready="true"]');
      return el !== null;
    });
  }, { timeout: 15000, message: 'data-canvas-ready="true" not found after set selection' }).toBeTruthy();
  await expect.poll(async () => {
    return await page.evaluate(() => Boolean((window as any).fabricCanvas));
  }, { timeout: 10000 }).toBeTruthy();
  await page.click('button[title="Pen"]', { force: true });
  await expect.poll(async () => {
    return await page.evaluate(() => Boolean((window as any).fabricCanvas?.isDrawingMode));
  }, { timeout: 10000 }).toBeTruthy();
}

// Helper: draw on canvas, retrying up to maxAttempts times until at least one object is created.
// Each attempt re-fetches the bounding box (canvas may have been resized) and performs a
// mouse-down → move (10 steps) → up stroke well inside the drawable area.  After each stroke
// we poll for a new object for up to 3 s before giving up and trying again.
async function drawOnCanvas(page: Page, dx = 150, dy = 100, maxAttempts = 3) {
  const canvas = page.locator('.upper-canvas');
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Re-poll bounding box each attempt; canvas could still be settling
    let box: { x: number; y: number; width: number; height: number } | null = null;
    await expect.poll(async () => {
      box = await canvas.boundingBox();
      return box !== null && box.width > 50 && box.height > 50;
    }, { timeout: 10000, message: 'Canvas not found or too small' }).toBeTruthy();
    if (!box) throw new Error('Canvas not found');

    const countBefore: number = await page.evaluate(() => {
      const c = (window as any).fabricCanvas;
      return c ? c.getObjects().length : 0;
    });

    // Start well inside the canvas (25% from top-left corner)
    const startX = box.x + Math.round(box.width * 0.25);
    const startY = box.y + Math.round(box.height * 0.25);
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(startX + dx, startY + dy, { steps: 10 });
    await page.mouse.up();

    // Poll for a new object for up to 3 s
    let grew = false;
    try {
      await expect.poll(async () => {
        const c = (window as any).fabricCanvas;
        return c ? c.getObjects().length > countBefore : false;
      }, { timeout: 3000 }).toBeTruthy();
      grew = true;
    } catch {
      // Stroke didn't register — loop and retry
    }
    if (grew) return;
  }
  // All attempts exhausted — let the individual test assertion report the failure
}

test.describe('Annotations — Core', () => {
  test('shows login prompt for unauthenticated users', async ({ page, context }) => {
    listenForErrors(page);
    await context.clearCookies();
    await page.goto('/reader/1');
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('text=Log in to annotate')).toBeVisible();
  });

  test('shows toolbar (not login prompt) when authenticated', async ({ page, context }) => {
    listenForErrors(page);
    await context.addCookies([{ name: 'sb-access-token', value: 'dummy-token', domain: 'localhost', path: '/' }]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });
    await page.goto('/reader/1');
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('text=Log in to annotate')).not.toBeVisible();
  });
});

test.describe('Toolbar tools', () => {
  test('pen tool draws a path on canvas', async ({ page }) => {
    listenForErrors(page);
    const setName = `Pen-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    // Pen is default tool; just draw
    await drawOnCanvas(page, 120, 80);

    const objCount = await page.evaluate(() => {
      // @ts-ignore
      const c = window.fabricCanvas;
      return c ? c.getObjects().filter((o: any) => o.type === 'path').length : 0;
    });
    expect(objCount).toBeGreaterThan(0);
  });

  test('highlighter tool draws a semi-transparent rect', async ({ page }) => {
    listenForErrors(page);
    const setName = `Hl-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    await page.click('button[title="Highlighter"]', { force: true });
    await expect(page.locator('text=Opacity')).toBeVisible();

    await page.click('button[title="Blue"]', { force: true });
    await drawOnCanvas(page, 160, 80);

    const result = await page.evaluate(() => {
      // @ts-ignore
      const c = window.fabricCanvas;
      if (!c) return null;
      const rects = c.getObjects().filter((o: any) => o.type === 'rect');
      return rects.length > 0 ? { count: rects.length, opacity: rects[0].opacity, fill: rects[0].fill } : null;
    });
    expect(result).not.toBeNull();
    expect(result!.count).toBeGreaterThan(0);
    expect(result!.opacity).toBeGreaterThan(0);
    expect(result!.opacity).toBeLessThan(1);
  });

  test('circle tool draws an ellipse on canvas', async ({ page }) => {
    listenForErrors(page);
    const setName = `Circle-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    await page.click('button[title="Circle"]', { force: true });
    await expect.poll(async () => page.evaluate(() => {
      const c = (window as any).fabricCanvas;
      return c != null && c.isDrawingMode === false;
    }), { timeout: 10000 }).toBeTruthy();
    await drawOnCanvas(page, 100, 80);

    const count = await page.evaluate(() => {
      // @ts-ignore
      const c = window.fabricCanvas;
      return c ? c.getObjects().filter((o: any) => o.type === 'ellipse').length : 0;
    });
    expect(count).toBeGreaterThan(0);
  });

  test('underline tool draws a horizontal line', async ({ page }) => {
    listenForErrors(page);
    const setName = `Ul-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    await page.click('button[title="Underline"]', { force: true });
    await expect.poll(async () => page.evaluate(() => {
      const c = (window as any).fabricCanvas;
      return c != null && c.isDrawingMode === false;
    }), { timeout: 10000 }).toBeTruthy();
    await drawOnCanvas(page, 120, 5); // nearly horizontal

    const count = await page.evaluate(() => {
      // @ts-ignore
      const c = window.fabricCanvas;
      return c ? c.getObjects().filter((o: any) => o.type === 'line').length : 0;
    });
    expect(count).toBeGreaterThan(0);
  });

  test('text tool places an IText object on canvas', async ({ page }) => {
    listenForErrors(page);
    const setName = `Txt-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    await page.click('button[title="Text"]', { force: true });

    const canvas = page.locator('.upper-canvas');
    let textBox: { x: number; y: number; width: number; height: number } | null = null;
    await expect.poll(async () => {
      textBox = await canvas.boundingBox();
      return textBox !== null && textBox.width > 0 && textBox.height > 0;
    }, { timeout: 10000 }).toBeTruthy();
    if (!textBox) throw new Error('Canvas not found');
    await page.mouse.click(textBox.x + 200, textBox.y + 200);

    const count = await page.evaluate(() => {
      // @ts-ignore
      const c = window.fabricCanvas;
      return c ? c.getObjects().filter((o: any) => o.type === 'i-text').length : 0;
    });
    expect(count).toBeGreaterThan(0);
  });
});

test.describe('Toolbar UX', () => {
  test('toolbar is always visible (not closable) on desktop', async ({ page }) => {
    listenForErrors(page);
    const setName = `TB-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    // Tools + swatches are visible, and there is no Hide/collapse affordance any more.
    await expect(page.locator('aside button[title="Red"]')).toBeVisible();
    await expect(page.locator('aside button[title="Pen"]')).toBeVisible();
    // No collapse/Hide affordance inside the toolbar aside any more (Notes card has its own Hide).
    await expect(page.locator('aside button:has-text("Hide")')).toHaveCount(0);
  });

  test('undo removes last drawn object', async ({ page }) => {
    listenForErrors(page);
    const setName = `Undo-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    // Draw something
    await drawOnCanvas(page, 120, 80);

    const before = await page.evaluate(() => {
      // @ts-ignore
      return window.fabricCanvas?.getObjects().length ?? 0;
    });
    expect(before).toBeGreaterThan(0);

    // Undo
    await page.click('button:has-text("Undo")');

    await expect.poll(async () => {
      return await page.evaluate(() => {
        // @ts-ignore
        return window.fabricCanvas?.getObjects().length ?? 0;
      });
    }, { timeout: 5000 }).toBeLessThan(before);
  });

  test('redo restores undone object', async ({ page }) => {
    listenForErrors(page);
    const setName = `Redo-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    await drawOnCanvas(page, 120, 80);
    
    const before = await page.evaluate(() => {
      // @ts-ignore
      return window.fabricCanvas?.getObjects().length ?? 0;
    });

    await page.click('button:has-text("Undo")');

    let afterUndo = before;
    await expect.poll(async () => {
      afterUndo = await page.evaluate(() => {
        // @ts-ignore
        return window.fabricCanvas?.getObjects().length ?? 0;
      });
      return afterUndo;
    }, { timeout: 5000 }).toBeLessThan(before);

    await page.click('button:has-text("Redo")');

    await expect.poll(async () => {
      return await page.evaluate(() => {
        // @ts-ignore
        return window.fabricCanvas?.getObjects().length ?? 0;
      });
    }, { timeout: 5000 }).toBeGreaterThan(afterUndo);
  });

  test('clear removes all objects after confirmation', async ({ page }) => {
    listenForErrors(page);
    const setName = `Clear-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    await drawOnCanvas(page, 120, 80);

    // Accept the confirmation dialog
    page.on('dialog', dialog => dialog.accept());
    await page.click('button:has-text("Clear")');

    const count = await page.evaluate(() => {
      // @ts-ignore
      return window.fabricCanvas?.getObjects().length ?? 0;
    });
    expect(count).toBe(0);
  });
});

test.describe('Notes Panel', () => {
  test('can add and see a note', async ({ page }) => {
    listenForErrors(page);
    const setName = `Notes-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    // Notes panel should be visible
    await expect(page.getByTestId('notes-card')).toBeVisible();

    // Add a note
    await page.fill('textarea[placeholder="Add a note about this page…"]', 'Test note content');
    await page.click('button:has-text("Add Note")');

    // Note appears in list
    await expect(page.locator('text=Test note content')).toBeVisible();
  });

  test('can delete a note', async ({ page }) => {
    listenForErrors(page);
    const setName = `NotesDel-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    await page.fill('textarea[placeholder="Add a note about this page…"]', 'Note to delete');
    await page.click('button:has-text("Add Note")');
    await expect(page.locator('text=Note to delete')).toBeVisible();

    // Hover over the note to reveal delete button
    await page.locator('text=Note to delete').hover();
    await page.click('button:has-text("Delete")');

    await expect(page.locator('text=Note to delete')).not.toBeVisible();
  });

  test('notes panel collapses and expands', async ({ page }) => {
    listenForErrors(page);
    const setName = `NotesColl-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    await expect(page.locator('textarea[placeholder="Add a note about this page…"]')).toBeVisible();

    await page.getByTestId('notes-card').getByRole('button', { name: /Hide/ }).click();
    await expect(page.locator('textarea[placeholder="Add a note about this page…"]')).not.toBeVisible();

    await page.getByTestId('notes-card').getByRole('button', { name: /Show/ }).click();
    await expect(page.locator('textarea[placeholder="Add a note about this page…"]')).toBeVisible();
  });
});

test.describe('Share Links', () => {
  test('share button is visible for authenticated users with sets', async ({ page }) => {
    listenForErrors(page);
    const setName = `Share-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    await expect(page.locator('button:has-text("Share")')).toBeVisible();
  });

  test('share link opens and shows copy button', async ({ page }) => {
    listenForErrors(page);
    const setName = `ShareCopy-${Date.now()}`;
    await setupAuthenticatedReader(page, setName);

    await page.click('button:has-text("Share")');

    // Copy button appears
    await expect(page.locator('button:has-text("Copy")')).toBeVisible();

    // URL input contains /share/
    const urlInput = page.locator('input[readonly]');
    await expect(urlInput).toBeVisible();
    const val = await urlInput.inputValue();
    expect(val).toContain('/share/');
    expect(val).toContain('?set=');
  });

  test('share page renders read-only canvas at share URL', async ({ page, context }) => {
    listenForErrors(page);
    // Get a set ID from mock — we'll visit /sets first
    await context.addCookies([{ name: 'sb-access-token', value: 'dummy-token', domain: 'localhost', path: '/' }]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });

    await page.goto('/sets');
    const setName = `ShareView-${Date.now()}`;
    await page.fill('input[placeholder="New set name..."]', setName);
    await page.click('button:has-text("Create")');
    await expect(page.locator(`text=${setName}`)).toBeVisible();

    // Get share link from reader
    await page.goto('/reader/1');
    await page.locator('#set-picker-top').selectOption({ label: setName });
    await page.click('button:has-text("Share")');

    const urlInput = page.locator('input[readonly]');
    await expect(urlInput).toBeVisible();
    const shareUrl = await urlInput.inputValue();
    expect(shareUrl).toContain('/share/');

    // Visit share URL (clear cookies to simulate anonymous visitor)
    await context.clearCookies();
    await page.goto(shareUrl);

    // Read-only badge and canvas
    await expect(page.locator('text=read-only').first()).toBeVisible();
    // Wait for canvas to fully initialize (background image loaded + Fabric.js ready)
    await expect(page.locator('[data-canvas-ready="true"]')).toBeVisible({ timeout: 15000 });
    const canvas = page.locator('.page-display-frame');
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.width).toBeGreaterThan(450);
      expect(box.height).toBeGreaterThan(600);
      expect(box.width).toBeLessThanOrEqual(viewport.width - 40);
      expect(box.height).toBeLessThanOrEqual(viewport.height);
    }

    // No toolbar buttons
    await expect(page.locator('button[title="Pen"]')).not.toBeVisible();
  });
});
