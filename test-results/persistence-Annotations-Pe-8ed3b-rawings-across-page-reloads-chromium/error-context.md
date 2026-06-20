# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: persistence.spec.ts >> Annotations Persistence >> should persist drawings across page reloads
- Location: src\tests\e2e\persistence.spec.ts:4:7

# Error details

```
Error: Wait for objects to be restored on canvas

Wait for objects to be restored on canvas

expect(received).toBeTruthy()

Received: false

Call Log:
- Timeout 10000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e2]:
    - navigation [ref=e3]:
      - generic [ref=e4]:
        - link "ح حفظ HifthCompanion" [ref=e5] [cursor=pointer]:
          - /url: /reader/1
          - generic [ref=e6]: ح
          - generic [ref=e7]:
            - generic [ref=e8]: حفظ
            - generic [ref=e9]: HifthCompanion
        - generic [ref=e10]:
          - button "Previous page" [disabled] [ref=e11]:
            - img [ref=e12]
          - button "1 / 604" [ref=e15]:
            - generic [ref=e16]: "1"
            - generic [ref=e17]: /
            - generic [ref=e18]: "604"
          - button "Next page" [ref=e19]:
            - img [ref=e20]
        - generic [ref=e22]:
          - link "My Sets" [ref=e23] [cursor=pointer]:
            - /url: /sets
            - img [ref=e24]
            - text: My Sets
          - button "Log out" [ref=e26]:
            - img [ref=e27]
            - generic [ref=e29]: Log out
    - main [ref=e30]:
      - generic [ref=e31]:
        - generic [ref=e34]:
          - generic [ref=e35]:
            - generic [ref=e36]:
              - generic [ref=e37]: Set
              - combobox "Set" [ref=e38] [cursor=pointer]:
                - option "Hl-1781992186276"
                - option "E2E Highlight Set"
                - option "Pen-1781992184211"
                - option "Test Set 1781992183018" [selected]
                - option "Redo-1781992072566"
                - option "Undo-1781992070977"
                - option "TB-1781992069477"
                - option "Txt-1781992067938"
                - option "Ul-1781992066304"
                - option "Circle-1781992064729"
                - option "Hl-1781992063021"
                - option "E2E Highlight Set"
                - option "Pen-1781992061026"
                - option "Test Set 1781992059670"
                - option "Test Set 1781991782009"
                - option "ShareView-1781991339729"
                - option "ShareCopy-1781991337997"
                - option "Share-1781991336649"
                - option "NotesColl-1781991335267"
                - option "NotesDel-1781991333693"
                - option "Notes-1781991332254"
                - option "Clear-1781991330757"
                - option "Redo-1781991329221"
                - option "Undo-1781991327826"
                - option "TB-1781991326404"
                - option "Txt-1781991324870"
                - option "Ul-1781991323302"
                - option "Circle-1781991321785"
                - option "Hl-1781991320224"
                - option "Pen-1781991318365"
                - option "E2E Highlight Set"
                - option "Test Set 1781991317333"
                - option "Test Set 1781991308431"
                - option "Redo-1781991297595"
                - option "Undo-1781991296154"
                - option "TB-1781991294848"
                - option "Txt-1781991293349"
                - option "Ul-1781991291932"
                - option "Circle-1781991290430"
                - option "Hl-1781991288792"
                - option "Pen-1781991287061"
                - option "E2E Highlight Set"
                - option "Test Set 1781991285934"
                - option "Clear-1781991278990"
                - option "Redo-1781991277481"
                - option "Undo-1781991276052"
                - option "TB-1781991274772"
                - option "Txt-1781991273521"
                - option "Ul-1781991271969"
                - option "Circle-1781991270475"
                - option "Hl-1781991268884"
                - option "E2E Highlight Set"
                - option "Pen-1781991266965"
                - option "Test Set 1781991265829"
                - option "ShareView-1781991220854"
                - option "ShareCopy-1781991219041"
                - option "Share-1781991217655"
                - option "NotesColl-1781991216333"
                - option "NotesDel-1781991214819"
                - option "Notes-1781991213487"
                - option "Clear-1781991212081"
                - option "Redo-1781991210522"
                - option "Undo-1781991209217"
                - option "TB-1781991207902"
                - option "Txt-1781991206546"
                - option "Ul-1781991205090"
                - option "Circle-1781991203652"
                - option "Hl-1781991202028"
                - option "E2E Highlight Set"
                - option "Pen-1781991200370"
                - option "Test Set 1781991199281"
                - option "Hl-1781991006655"
                - option "E2E Highlight Set"
                - option "Pen-1781991004007"
                - option "Test Set 1781991002959"
                - option "ShareView-1781990262006"
                - option "ShareCopy-1781990260722"
                - option "Share-1781990259697"
                - option "NotesColl-1781990258551"
                - option "NotesDel-1781990257190"
                - option "Notes-1781990256179"
                - option "Clear-1781990254947"
                - option "Redo-1781990253721"
                - option "Undo-1781990252382"
                - option "TB-1781990251277"
                - option "Txt-1781990250191"
                - option "Ul-1781990248858"
                - option "Circle-1781990247686"
                - option "Hl-1781990246330"
                - option "E2E Highlight Set"
                - option "Pen-1781990244841"
                - option "Test Set 1781990243775"
                - option "Test Set 1781990211058"
                - option "Notes-1781990181275"
                - option "Clear-1781990180114"
                - option "Redo-1781990178762"
                - option "Undo-1781990177487"
                - option "TB-1781990176434"
                - option "Txt-1781990175404"
                - option "Ul-1781990173979"
                - option "Circle-1781990172821"
                - option "Hl-1781990171544"
                - option "Pen-1781990170100"
                - option "E2E Highlight Set"
                - option "Test Set 1781990169130"
                - option "ShareView-1781990153425"
                - option "ShareCopy-1781990152067"
                - option "Share-1781990151050"
                - option "NotesColl-1781990150052"
                - option "NotesDel-1781990148961"
                - option "Notes-1781990147848"
                - option "Clear-1781990146696"
                - option "Redo-1781990145399"
                - option "Undo-1781990144141"
                - option "TB-1781990143155"
                - option "Txt-1781990142053"
                - option "Ul-1781990140851"
                - option "Circle-1781990139786"
                - option "Hl-1781990138492"
                - option "E2E Highlight Set"
                - option "Pen-1781990137191"
                - option "Test Set 1781990136104"
                - option "Notes-1781990075153"
                - option "Clear-1781990074026"
                - option "Redo-1781990072671"
                - option "Undo-1781990071483"
                - option "TB-1781990070384"
                - option "Txt-1781990069273"
                - option "Ul-1781990068189"
                - option "Circle-1781990067054"
                - option "Hl-1781990065917"
                - option "Pen-1781990064552"
                - option "E2E Highlight Set"
                - option "Test Set 1781990063524"
                - option "E2E Highlight Set"
                - option "Pen-1781990050703"
                - option "Test Set 1781990049712"
                - option "E2E Highlight Set"
                - option "E2E Highlight Set"
            - button "Hide" [ref=e39]:
              - img [ref=e40]
              - text: Hide
          - generic [ref=e42]:
            - generic [ref=e43]:
              - button "Pen" [ref=e44]:
                - img [ref=e45]
              - button "Highlighter" [ref=e47]:
                - img [ref=e48]
              - button "Circle" [ref=e50]:
                - img [ref=e51]
              - button "Underline" [ref=e53]:
                - img [ref=e54]
              - button "Text" [ref=e56]:
                - img [ref=e57]
              - button "Eraser" [ref=e59]:
                - img [ref=e60]
            - generic [ref=e62]:
              - button "Red" [ref=e63]
              - button "Orange" [ref=e64]
              - button "Yellow" [ref=e65]
              - button "Green" [ref=e66]
              - button "Blue" [ref=e67]
            - generic [ref=e68]:
              - generic [ref=e69]: Width
              - slider [ref=e70] [cursor=pointer]: "3"
              - generic [ref=e71]: "3"
            - generic [ref=e72]:
              - button "Undo" [disabled] [ref=e73]:
                - img [ref=e74]
                - text: Undo
              - button "Redo" [disabled] [ref=e76]:
                - text: Redo
                - img [ref=e77]
              - button "Clear" [ref=e79]:
                - img [ref=e80]
                - text: Clear
        - generic [ref=e86]:
          - generic [ref=e87]:
            - generic [ref=e88]:
              - heading "Share Page" [level=3] [ref=e89]
              - paragraph [ref=e90]: Generate a read-only link to share your annotations and notes with others.
            - button "Share" [ref=e93]:
              - img [ref=e94]
              - text: Share
          - complementary [ref=e97]:
            - generic [ref=e98]:
              - generic [ref=e100]: 📝 Notes
              - button "Hide" [ref=e101]:
                - img [ref=e102]
                - text: Hide
            - generic [ref=e104]:
              - paragraph [ref=e106]: No notes yet for this page.
              - generic [ref=e107]:
                - textbox "Add a note about this page…" [ref=e108]
                - generic [ref=e109]:
                  - generic [ref=e110]: Ctrl+Enter to save
                  - button "Add Note" [disabled] [ref=e111]:
                    - img [ref=e112]
                    - text: Add Note
    - contentinfo [ref=e114]: HifthCompanion © 2026
  - button "Open Next.js Dev Tools" [ref=e120] [cursor=pointer]:
    - img [ref=e121]
  - alert [ref=e124]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Annotations Persistence', () => {
  4  |   test('should persist drawings across page reloads', async ({ page }) => {
  5  |     page.on('console', msg => console.log(`[Browser] ${msg.text()}`));
  6  | 
  7  |     // 1. Setup authenticated session
  8  |     // Note: We are using the storageState from auth.setup.ts
  9  |     // We don't need to manually inject cookies here.
  10 |     
  11 |     // Fail on console errors
  12 |     const logs: string[] = [];
  13 |     page.on('console', msg => {
  14 |       const text = msg.text();
  15 |       logs.push(text);
  16 |       if (msg.type() === 'error' && !text.includes('React DevTools')) {
  17 |         // Log it before throwing so we can see it in terminal
  18 |         console.error(`[Browser Error]: ${text}`);
  19 |       }
  20 |     });
  21 | 
  22 |     // 2. Go to sets page to create a REAL set
  23 |     await page.goto('/sets');
  24 |     const setName = `Test Set ${Date.now()}`;
  25 |     await page.fill('input[placeholder="New set name..."]', setName);
  26 |     await page.click('button:has-text("Create")');
  27 |     await expect(page.locator(`text=${setName}`)).toBeVisible();
  28 | 
  29 |     // 3. Go to reader page
  30 |     await page.goto('/reader/1');
  31 | 
  32 |     // 4. Wait for canvas to be initialized and set selected
  33 |     const upperCanvas = page.locator('.upper-canvas');
  34 |     await expect(upperCanvas).toBeVisible();
  35 |     
  36 |     // Verify our new set is selected
  37 |     const picker = page.locator('#set-picker');
  38 |     await expect(picker).toContainText(setName);
  39 | 
  40 |     // 5. Draw on the canvas
  41 |     const box = await upperCanvas.boundingBox();
  42 |     if (!box) throw new Error('Canvas not found');
  43 |     
  44 |     await page.mouse.move(box.x + 100, box.y + 100);
  45 |     await page.mouse.down();
  46 |     await page.mouse.move(box.x + 200, box.y + 200, { steps: 5 });
  47 |     await page.mouse.up();
  48 | 
  49 |     // 6. Wait for explicit save confirmation
  50 |     await expect.poll(() => logs.some(l => l.includes('Save successful')), {
  51 |       message: 'Wait for "Save successful" log',
  52 |       timeout: 10000,
  53 |     }).toBeTruthy();
  54 | 
  55 |     // 7. Reload and verify
  56 |     const lsBefore = await page.evaluate(() => localStorage.getItem('mock_supabase_annotations'));
  57 |     console.error('[E2E DEBUG] LS BEFORE:', lsBefore);
  58 |     await page.reload();
  59 |     const lsAfter = await page.evaluate(() => localStorage.getItem('mock_supabase_annotations'));
  60 |     console.error('[E2E DEBUG] LS AFTER:', lsAfter);
  61 |     
  62 |     // Ensure our set is selected (to avoid parallel test pollution)
  63 |     const pickerAfter = page.locator('#set-picker');
  64 |     await pickerAfter.selectOption({ label: setName });
  65 |     
  66 |     // Check if drawing restored
  67 |     await expect.poll(async () => {
  68 |       return await page.evaluate(() => {
  69 |         // @ts-ignore
  70 |         const canvas = window.fabricCanvas;
  71 |         return canvas ? canvas.getObjects().length > 0 : false;
  72 |       });
  73 |     }, {
  74 |       message: 'Wait for objects to be restored on canvas',
  75 |       timeout: 10000,
> 76 |     }).toBeTruthy();
     |        ^ Error: Wait for objects to be restored on canvas
  77 |   });
  78 | });
  79 | 
```