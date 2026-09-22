import { test, expect, type Page } from '@playwright/test';

// 0015 wird — daily-screen E2E (O5–O7). Runs against the live app + the mock
// Supabase store, seeded through the test-only /api/test/tracker route (the same
// harness tracker.spec uses). Asserts OUTCOMES of completing a wird, not that a
// button rendered (AGENTS.md high-signal policy).

const MOCK_USER_ID = '52345ff6-3348-40d5-b6d8-1234567890ab'; // matches auth.setup

// A no-entry 'pages' wird at rate 1 page/day over pages 1..end. Fresh cards read
// "start at page 1" and "<end> pages to go".
function seedWird(id: string, name: string, pageEnd: number) {
  const now = new Date().toISOString();
  return {
    id,
    user_id: MOCK_USER_ID,
    name,
    scope_source: 'pages',
    page_start: 1,
    page_end: pageEnd,
    pages_per_period: 1,
    period_days: 1,
    cycle_seq: 1,
    cycle_page_start: 1,
    cycle_page_end: pageEnd,
    deleted_at: null,
    created_at: now,
  };
}

// O7: every test fails on a browser console error.
function guardConsole(page: Page) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`);
  });
}

async function reset(page: Page, wirds: unknown[]) {
  await page.request.post('/api/test/tracker', { data: { reset: true } });
  await page.request.post('/api/test/tracker', { data: { seed: { wird: wirds } } });
}

// An enabled Done disc = an outstanding wird's control (done cards are disabled).
const outstandingDone = (page: Page) =>
  page.locator('button[aria-label="Done"]:not([disabled])');

test.describe('Wird daily screen', () => {
  test('O5: completing a wird advances the position and clears the card', async ({ page }) => {
    guardConsole(page);
    await reset(page, [seedWird('w-o5', 'Fajr wird', 10)]);

    await page.goto('/wird');

    // Outstanding card: real values, not just a button.
    await expect(page.getByText('10 pages to go')).toBeVisible();
    // Opening reference for page 1 (a sūra name + ayah), the span after "Start at".
    const openingRef = (
      await page.getByText('Start at', { exact: true })
        .locator('xpath=following-sibling::span[1]')
        .innerText()
    ).trim();

    // Complete it.
    await outstandingDone(page).click();

    // Outcome, after the route refresh brings back the server state:
    // the outstanding strip is gone (card left) → the all-done screen takes over.
    await expect(page.getByText('All done today')).toBeVisible({ timeout: 15000 });
    // Position advanced: the "next begins at" line points past where it started
    // (page 1 → page 2 = a different sūra), so it is NOT the original opening ref.
    const nextLine = page.locator('li', { hasText: /next begins at/i });
    await expect(nextLine).toBeVisible();
    // The next portion no longer starts at page 1's opening reference.
    expect((await nextLine.innerText())).not.toContain(openingRef);

    // Entry persisted (not just optimistic UI): a fresh navigation still shows
    // done, driven by the server re-read of wird_entry.
    await page.goto('/wird');
    await expect(page.getByText('All done today')).toBeVisible();
    await expect(page.getByText('10 pages to go')).toHaveCount(0);
  });

  test('O6: completing the LAST outstanding wird reaches the all-done screen', async ({ page }) => {
    guardConsole(page);
    await reset(page, [seedWird('w-a', 'Morning wird', 5), seedWird('w-b', 'Evening wird', 5)]);

    await page.goto('/wird');
    // Two outstanding wirds → not all done yet.
    await expect(page.getByText('All done today')).toHaveCount(0);

    // Complete the first outstanding wird.
    await outstandingDone(page).first().click();
    // One remains → still not all done.
    await expect(outstandingDone(page)).toHaveCount(1, { timeout: 15000 });
    await expect(page.getByText('All done today')).toHaveCount(0);

    // Complete the last one → the all-done screen appears.
    await outstandingDone(page).first().click();
    await expect(page.getByText('All done today')).toBeVisible({ timeout: 15000 });
  });

  test('create: a start page midway shortens the first pass', async ({ page }) => {
    guardConsole(page);
    await reset(page, []); // empty state → the direct New wird button

    await page.goto('/wird');
    await page.getByRole('button', { name: 'New wird' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New wird' });
    await dialog.getByLabel('Name').fill('Midway wird');
    // Pages 1..10, already through 1..4 → start at 5.
    await dialog.getByRole('spinbutton', { name: 'Last page' }).fill('10');
    await dialog.getByRole('spinbutton', { name: 'Start from page' }).fill('5');
    await dialog.getByRole('button', { name: 'Create' }).click();

    // Outcome, read back from the server: pages 5..10 remain, not the full 10.
    await page.goto('/wird');
    await expect(page.getByText('6 pages to go')).toHaveCount(1);
    await expect(page.getByText('10 pages to go')).toHaveCount(0);
  });

  test('create: a memorized wird can start midway, skipping gap pages', async ({ page }) => {
    guardConsole(page);
    await reset(page, []);
    // Memorized pages {1, 2, 3, 604}: al-Fatiha, al-Baqara 1–16, and the last page.
    await page.request.post('/api/test/tracker', {
      data: {
        seed: {
          user_hifth: [{
            user_id: MOCK_USER_ID,
            memorized_ranges: [
              { surah: 1, from: 1, to: 7 },
              { surah: 2, from: 1, to: 16 },
              { surah: 112, from: 1, to: 4 },
              { surah: 113, from: 1, to: 5 },
              { surah: 114, from: 1, to: 6 },
            ],
            weakest_surahs: [],
            onboarded_at: new Date().toISOString(),
          }],
        },
      },
    });

    await page.goto('/wird');
    await page.getByRole('button', { name: 'New wird' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'New wird' });
    await dialog.getByLabel('Name').fill('Memorized midway');
    await dialog.getByRole('button', { name: 'What I’ve memorized' }).click();
    // Already through pages 1–2 → start at 3.
    await dialog.getByRole('spinbutton', { name: 'Start from page' }).fill('3');
    await dialog.getByRole('button', { name: 'Create' }).click();

    // Outcome: pages 3 and 604 remain (gap 4..603 skipped), not all 4.
    await page.goto('/wird');
    await expect(page.getByText('2 pages to go')).toHaveCount(1);
    await expect(page.getByText('4 pages to go')).toHaveCount(0);
  });

  test('heatmap: completing a wird fills today\'s cell on the manage screen', async ({ page }) => {
    guardConsole(page);
    // The manage screen pulls a Google-hosted Arabic font; the suite-wide x-e2e-test
    // header fails that cross-origin CORS preflight (harness artifact, not an app bug).
    await page.route('https://fonts.gstatic.com/**', (r) =>
      r.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } }));
    await reset(page, [seedWird('w-hm', 'Heatmap wird', 10)]);

    const d = new Date();
    const todayIso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const todayCell = page.locator(`[title="${todayIso}"]`);

    // Before: grid rendered, nothing done.
    await page.goto('/wird/manage');
    await expect(todayCell).toHaveCount(1);
    await expect(page.locator('[data-done]')).toHaveCount(0);

    await page.goto('/wird');
    await outstandingDone(page).click();
    await expect(page.getByText('All done today')).toBeVisible({ timeout: 15000 });

    // After: exactly today's cell is filled, read back from the server.
    await page.goto('/wird/manage');
    await expect(todayCell).toHaveAttribute('data-done', 'true');
    await expect(page.locator('[data-done]')).toHaveCount(1);
  });
});
