# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: features.spec.ts >> Toolbar UX >> redo restores undone object
- Location: src\tests\e2e\features.spec.ts:191:7

# Error details

```
Error: page.click: Test ended.
Call log:
  - waiting for locator('button:has-text("Redo")')
    - locator resolved to <button title="Redo" class="btn btn-ghost flex items-center gap-1">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - performing click action

```

# Test source

```ts
  114 |     await setupAuthenticatedReader(page, setName);
  115 | 
  116 |     await page.click('button[title="Underline"]');
  117 |     await drawOnCanvas(page, 120, 5); // nearly horizontal
  118 | 
  119 |     const count = await page.evaluate(() => {
  120 |       // @ts-ignore
  121 |       const c = window.fabricCanvas;
  122 |       return c ? c.getObjects().filter((o: any) => o.type === 'line').length : 0;
  123 |     });
  124 |     expect(count).toBeGreaterThan(0);
  125 |   });
  126 | 
  127 |   test('text tool places an IText object on canvas', async ({ page }) => {
  128 |     listenForErrors(page);
  129 |     const setName = `Txt-${Date.now()}`;
  130 |     await setupAuthenticatedReader(page, setName);
  131 | 
  132 |     await page.click('button[title="Text"]');
  133 | 
  134 |     const canvas = page.locator('.upper-canvas');
  135 |     const box = await canvas.boundingBox();
  136 |     if (!box) throw new Error('Canvas not found');
  137 |     await page.mouse.click(box.x + 200, box.y + 200);
  138 | 
  139 |     const count = await page.evaluate(() => {
  140 |       // @ts-ignore
  141 |       const c = window.fabricCanvas;
  142 |       return c ? c.getObjects().filter((o: any) => o.type === 'i-text').length : 0;
  143 |     });
  144 |     expect(count).toBeGreaterThan(0);
  145 |   });
  146 | });
  147 | 
  148 | test.describe('Toolbar UX', () => {
  149 |   test('toolbar collapses and expands', async ({ page }) => {
  150 |     listenForErrors(page);
  151 |     const setName = `TB-${Date.now()}`;
  152 |     await setupAuthenticatedReader(page, setName);
  153 | 
  154 |     // Color swatches should be visible initially
  155 |     await expect(page.locator('button[title="Red"]')).toBeVisible();
  156 | 
  157 |     // Collapse toolbar
  158 |     await page.click('button:has-text("Hide")');
  159 |     await expect(page.locator('button[title="Red"]')).not.toBeVisible();
  160 | 
  161 |     // Re-expand
  162 |     await page.click('button:has-text("Tools")');
  163 |     await expect(page.locator('button[title="Red"]')).toBeVisible();
  164 |   });
  165 | 
  166 |   test('undo removes last drawn object', async ({ page }) => {
  167 |     listenForErrors(page);
  168 |     const setName = `Undo-${Date.now()}`;
  169 |     await setupAuthenticatedReader(page, setName);
  170 | 
  171 |     // Draw something
  172 |     await drawOnCanvas(page, 120, 80);
  173 | 
  174 |     const before = await page.evaluate(() => {
  175 |       // @ts-ignore
  176 |       return window.fabricCanvas?.getObjects().length ?? 0;
  177 |     });
  178 |     expect(before).toBeGreaterThan(0);
  179 | 
  180 |     // Undo
  181 |     await page.click('button:has-text("Undo")');
  182 | 
  183 |     await expect.poll(async () => {
  184 |       return await page.evaluate(() => {
  185 |         // @ts-ignore
  186 |         return window.fabricCanvas?.getObjects().length ?? 0;
  187 |       });
  188 |     }, { timeout: 5000 }).toBeLessThan(before);
  189 |   });
  190 | 
  191 |   test('redo restores undone object', async ({ page }) => {
  192 |     listenForErrors(page);
  193 |     const setName = `Redo-${Date.now()}`;
  194 |     await setupAuthenticatedReader(page, setName);
  195 | 
  196 |     await drawOnCanvas(page, 120, 80);
  197 |     
  198 |     const before = await page.evaluate(() => {
  199 |       // @ts-ignore
  200 |       return window.fabricCanvas?.getObjects().length ?? 0;
  201 |     });
  202 | 
  203 |     await page.click('button:has-text("Undo")');
  204 | 
  205 |     let afterUndo = before;
  206 |     await expect.poll(async () => {
  207 |       afterUndo = await page.evaluate(() => {
  208 |         // @ts-ignore
  209 |         return window.fabricCanvas?.getObjects().length ?? 0;
  210 |       });
  211 |       return afterUndo;
  212 |     }, { timeout: 5000 }).toBeLessThan(before);
  213 | 
> 214 |     await page.click('button:has-text("Redo")');
      |                ^ Error: page.click: Test ended.
  215 | 
  216 |     await expect.poll(async () => {
  217 |       return await page.evaluate(() => {
  218 |         // @ts-ignore
  219 |         return window.fabricCanvas?.getObjects().length ?? 0;
  220 |       });
  221 |     }, { timeout: 5000 }).toBeGreaterThan(afterUndo);
  222 |   });
  223 | 
  224 |   test('clear removes all objects after confirmation', async ({ page }) => {
  225 |     listenForErrors(page);
  226 |     const setName = `Clear-${Date.now()}`;
  227 |     await setupAuthenticatedReader(page, setName);
  228 | 
  229 |     await drawOnCanvas(page, 120, 80);
  230 | 
  231 |     // Accept the confirmation dialog
  232 |     page.on('dialog', dialog => dialog.accept());
  233 |     await page.click('button:has-text("Clear")');
  234 | 
  235 |     const count = await page.evaluate(() => {
  236 |       // @ts-ignore
  237 |       return window.fabricCanvas?.getObjects().length ?? 0;
  238 |     });
  239 |     expect(count).toBe(0);
  240 |   });
  241 | });
  242 | 
  243 | test.describe('Notes Panel', () => {
  244 |   test('can add and see a note', async ({ page }) => {
  245 |     listenForErrors(page);
  246 |     const setName = `Notes-${Date.now()}`;
  247 |     await setupAuthenticatedReader(page, setName);
  248 | 
  249 |     // Notes panel should be visible
  250 |     await expect(page.locator('text=📝 Notes')).toBeVisible();
  251 | 
  252 |     // Add a note
  253 |     await page.fill('textarea[placeholder="Add a note about this page…"]', 'Test note content');
  254 |     await page.click('button:has-text("Add Note")');
  255 | 
  256 |     // Note appears in list
  257 |     await expect(page.locator('text=Test note content')).toBeVisible();
  258 |   });
  259 | 
  260 |   test('can delete a note', async ({ page }) => {
  261 |     listenForErrors(page);
  262 |     const setName = `NotesDel-${Date.now()}`;
  263 |     await setupAuthenticatedReader(page, setName);
  264 | 
  265 |     await page.fill('textarea[placeholder="Add a note about this page…"]', 'Note to delete');
  266 |     await page.click('button:has-text("Add Note")');
  267 |     await expect(page.locator('text=Note to delete')).toBeVisible();
  268 | 
  269 |     // Hover over the note to reveal delete button
  270 |     await page.locator('text=Note to delete').hover();
  271 |     await page.click('button:has-text("Delete")');
  272 | 
  273 |     await expect(page.locator('text=Note to delete')).not.toBeVisible();
  274 |   });
  275 | 
  276 |   test('notes panel collapses and expands', async ({ page }) => {
  277 |     listenForErrors(page);
  278 |     const setName = `NotesColl-${Date.now()}`;
  279 |     await setupAuthenticatedReader(page, setName);
  280 | 
  281 |     await expect(page.locator('textarea[placeholder="Add a note about this page…"]')).toBeVisible();
  282 | 
  283 |     await page.locator('aside').filter({ hasText: '📝 Notes' }).getByRole('button', { name: /Hide/ }).click();
  284 |     await expect(page.locator('textarea[placeholder="Add a note about this page…"]')).not.toBeVisible();
  285 | 
  286 |     await page.locator('aside').filter({ hasText: '📝 Notes' }).getByRole('button', { name: /Show/ }).click();
  287 |     await expect(page.locator('textarea[placeholder="Add a note about this page…"]')).toBeVisible();
  288 |   });
  289 | });
  290 | 
  291 | test.describe('Share Links', () => {
  292 |   test('share button is visible for authenticated users with sets', async ({ page }) => {
  293 |     listenForErrors(page);
  294 |     const setName = `Share-${Date.now()}`;
  295 |     await setupAuthenticatedReader(page, setName);
  296 | 
  297 |     await expect(page.locator('button:has-text("Share")')).toBeVisible();
  298 |   });
  299 | 
  300 |   test('share link opens and shows copy button', async ({ page }) => {
  301 |     listenForErrors(page);
  302 |     const setName = `ShareCopy-${Date.now()}`;
  303 |     await setupAuthenticatedReader(page, setName);
  304 | 
  305 |     await page.click('button:has-text("Share")');
  306 | 
  307 |     // Copy button appears
  308 |     await expect(page.locator('button:has-text("Copy")')).toBeVisible();
  309 | 
  310 |     // URL input contains /share/
  311 |     const urlInput = page.locator('input[readonly]');
  312 |     await expect(urlInput).toBeVisible();
  313 |     const val = await urlInput.inputValue();
  314 |     expect(val).toContain('/share/');
```