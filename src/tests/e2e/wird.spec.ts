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
  await page.request.post('/api/test/tracker', { data: { reset: ['wird', 'wird_entry', 'user_hifth'] } });
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

    // Hold every server round-trip (the Done write + the refresh) so anything
    // shown below is known before Done, not fetched after it.
    await page.route('**/wird**', async (route) => {
      if (route.request().resourceType() === 'fetch') await new Promise((r) => setTimeout(r, 8000));
      await route.continue().catch(() => {});
    });

    // Complete it. The Done write is a server-action POST; keep its response
    // to await before re-reading the server below.
    const written = page.waitForResponse((r) => r.request().method() === 'POST', { timeout: 20000 });
    await outstandingDone(page).click();

    // Outcome, with the server still held: the card leaves → all-done screen,
    // and the "next begins at" line is already there (no wait on the refresh).
    await expect(page.getByRole('heading', { name: 'All done today' })).toBeVisible({ timeout: 5000 });
    const nextLine = page.locator('li', { hasText: /next begins at/i });
    await expect(nextLine).toBeVisible({ timeout: 3000 });
    // Position advanced (page 1 → page 2 = a different sūra), so it is NOT the
    // original opening ref.
    const nextText = await nextLine.innerText();
    expect(nextText).not.toContain(openingRef);
    await page.unroute('**/wird**');
    await written;

    // Entry persisted (not just optimistic UI): a fresh navigation still shows
    // done, driven by the server re-read of wird_entry.
    await page.goto('/wird');
    await expect(page.getByRole('heading', { name: 'All done today' })).toBeVisible();
    await expect(page.getByText('10 pages to go')).toHaveCount(0);
    // The server's advanced position matches what was shown up front.
    await expect(page.locator('li', { hasText: /next begins at/i })).toHaveText(nextText);
  });

  test('O6: completing the LAST outstanding wird reaches the all-done screen', async ({ page }) => {
    guardConsole(page);
    await reset(page, [seedWird('w-a', 'Morning wird', 5), seedWird('w-b', 'Evening wird', 5)]);

    await page.goto('/wird');
    // Two outstanding wirds → not all done yet.
    await expect(page.getByRole('heading', { name: 'All done today' })).toHaveCount(0);

    // Complete the first outstanding wird.
    await outstandingDone(page).first().click();
    // One remains → still not all done.
    await expect(outstandingDone(page)).toHaveCount(1, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'All done today' })).toHaveCount(0);

    // Complete the last one → the all-done screen appears.
    await outstandingDone(page).first().click();
    await expect(page.getByRole('heading', { name: 'All done today' })).toBeVisible({ timeout: 15000 });
  });

  test('exit: Done on a middle card slides only the next card in, the previous one stays put', async ({ page }) => {
    guardConsole(page);
    await reset(page, [seedWird('w-1', 'Wird A', 5), seedWird('w-2', 'Wird B', 6), seedWird('w-3', 'Wird C', 7)]);

    await page.goto('/wird');
    // The card centred in the strip (scroll-clipped, so measured, not toBeInViewport).
    const centred = () => page.evaluate(() => {
      const slides = [...document.querySelectorAll('.wird-slide')];
      const box = slides[0].parentElement!.getBoundingClientRect();
      const mid = box.left + box.width / 2;
      // Settled, not mid smooth-scroll: the centred slide sits flush with the strip.
      const hit = slides.find((s) => { const r = s.getBoundingClientRect(); return r.left <= mid && r.right >= mid && Math.abs(r.left - box.left) <= 1; });
      return [...(hit?.querySelectorAll('span') ?? [])].map((x) => x.textContent).find((x) => /^\d+ pages to go$/.test(x ?? '')) ?? null;
    });
    // Strip order, as rendered (each card's distinct pages-to-go).
    await expect(outstandingDone(page)).toHaveCount(3);
    const order = await page.locator('.wird-slide').evaluateAll((slides) => slides.map((sl) =>
      [...sl.querySelectorAll('span')].map((x) => x.textContent).find((x) => /^\d+ pages to go$/.test(x ?? ''))));
    await page.getByRole('button', { name: 'Next wird' }).click();
    await expect.poll(centred).toBe(order[1]); // one card on, not past it

    // Watch the left card through the whole exit: it must never scroll back into view.
    await page.evaluate(() => {
      const scroller = document.querySelector('.wird-slide')!.parentElement!;
      const left = document.querySelectorAll('.wird-slide')[0];
      const w = window as unknown as { leftSeen: number };
      w.leftSeen = 0;
      const tick = () => {
        w.leftSeen = Math.max(w.leftSeen, left.getBoundingClientRect().right - scroller.getBoundingClientRect().left);
        if (left.isConnected) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await outstandingDone(page).nth(1).click();
    await expect(outstandingDone(page)).toHaveCount(2, { timeout: 15000 });
    await expect.poll(centred).toBe(order[2]); // the next card took its place
    expect(await page.evaluate(() => (window as unknown as { leftSeen: number }).leftSeen)).toBeLessThanOrEqual(1);
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

  test('stale: done yesterday is simply due today; a missed day says "Waiting since yesterday"', async ({ page }) => {
    guardConsole(page);
    const day = (ago: number) => new Date(Date.now() - ago * 86_400_000).toISOString().slice(0, 10); // UTC, like the app
    const entry = (wirdId: string, ago: number) => ({
      id: `e-${wirdId}`, wird_id: wirdId, user_id: MOCK_USER_ID, entry_date: day(ago), cycle_seq: 1, page_start: 1, page_end: 1,
    });
    await reset(page, [seedWird('w-fresh', 'Fresh wird', 10), seedWird('w-missed', 'Missed wird', 10)]);
    await page.request.post('/api/test/tracker', { data: { seed: { wird_entry: [entry('w-fresh', 1), entry('w-missed', 2)] } } });

    await page.goto('/wird');
    await expect(page.getByText('9 pages to go')).toHaveCount(2); // both entries counted
    await expect(page.getByText(/^Waiting/)).toHaveCount(1);
    await expect(page.getByText('Waiting since yesterday')).toHaveCount(1);
  });

  test('create: New wird works again after a create, with a fresh form', async ({ page }) => {
    guardConsole(page);
    await reset(page, [seedWird('w-first', 'First wird', 10)]);

    await page.goto('/wird');
    const dialog = page.getByRole('dialog', { name: 'New wird' });
    for (const name of ['Second wird', 'Third wird']) {
      await page.getByRole('button', { name: 'Options' }).click();
      await page.getByRole('menuitem', { name: 'New wird' }).click();
      await expect(dialog.getByLabel('Name')).toHaveValue(''); // not the last create's name
      await dialog.getByLabel('Name').fill(name);
      await dialog.getByRole('spinbutton', { name: 'Last page' }).fill('20');
      await dialog.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByText('20 pages to go')).toHaveCount(name === 'Second wird' ? 1 : 2);
    }
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
    // Already through pages 1–2 → start at 3. The stepper walks memorized pages
    // only: + from 3 jumps the gap to 604, − comes back to 3.
    const start = dialog.getByRole('spinbutton', { name: 'Start from page' });
    const stepper = dialog.locator('label').filter({ hasText: 'Start from page' });
    await start.fill('2');
    await stepper.getByRole('button', { name: '+' }).click();
    await expect(start).toHaveValue('3');
    await stepper.getByRole('button', { name: '+' }).click();
    await expect(start).toHaveValue('604');
    await expect(dialog.getByTestId('start-page-content')).toHaveText('Al-Ikhlaas 1–4 · Al-Falaq 1–5 · An-Naas 1–6');
    await stepper.getByRole('button', { name: '−' }).click();
    await expect(start).toHaveValue('3');
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

    // UTC day, as the app stamps entries and keys the heatmap (a local date
    // disagrees for the first/last hours of the day off-UTC).
    const todayIso = new Date().toISOString().slice(0, 10);
    const todayCell = page.locator(`[title="${todayIso}"]`);

    // Before: grid rendered, nothing done.
    await page.goto('/wird/manage');
    await expect(todayCell).toHaveCount(1);
    await expect(page.locator('[data-done]')).toHaveCount(0);

    await page.goto('/wird');
    await outstandingDone(page).click();
    await expect(page.getByRole('heading', { name: 'All done today' })).toBeVisible({ timeout: 15000 });

    // After: exactly today's cell is filled, read back from the server.
    await page.goto('/wird/manage');
    await expect(todayCell).toHaveAttribute('data-done', 'true');
    await expect(page.locator('[data-done]')).toHaveCount(1);
  });

  test('fit: on a short screen the card shrinks, the page never scrolls, controls work', async ({ page }) => {
    guardConsole(page);
    await reset(page, [seedWird('w-fit', 'Short screen wird', 10)]);

    for (const [width, height] of [[375, 420], [640, 360]]) {
      await page.setViewportSize({ width, height });
      await page.goto('/wird');
      await expect(page.getByText('10 pages to go')).toBeVisible();
      // No page scroll: the document is exactly the viewport tall.
      expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
      // Both controls fully on screen, not clipped below the fold.
      await expect(outstandingDone(page)).toBeInViewport({ ratio: 1 });
      await expect(page.getByRole('button', { name: 'Options' })).toBeInViewport({ ratio: 1 });
    }

    // Android PWA after pull-to-refresh: dvh resolves taller than the visible
    // area. Simulate it; the screen must still fit, since it can't rely on dvh.
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('/wird');
    await page.addStyleTag({ content: '.min-h-dvh { min-height: calc(100dvh + 46px); }' });
    await expect(page.getByText('10 pages to go')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight)).toBe(true);
    await expect(page.getByRole('button', { name: 'Options' })).toBeInViewport({ ratio: 1 });

    // Outcome, not just presence: the options menu opens and Done completes.
    await page.getByRole('button', { name: 'Options' }).click();
    await expect(page.getByRole('menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await outstandingDone(page).click();
    await expect(page.getByRole('heading', { name: 'All done today' })).toBeVisible({ timeout: 15000 });
  });
});

// 0016 daily reminder. The push itself needs a real push service, so these pin
// what the user controls: the saved time, the Off switch, and the one-time
// offer after the first wird.
test.describe('Wird reminder', () => {
  const setReminder = async (page: Page, value: string) => {
    await page.goto('/settings');
    const select = page.getByLabel('Daily wird reminder');
    await select.selectOption(value);
    await expect(page.getByText('Saving…')).toHaveCount(0);
  };

  test('settings: the reminder time saves, survives a reload, and can be turned off', async ({ page }) => {
    guardConsole(page);
    // Not asked yet, not subscribed = push is off on this device. (Granting it
    // instead would make PushToggle quietly subscribe.)
    await page.addInitScript(() => {
      Object.defineProperty(Notification, 'permission', { get: () => 'default' });
      // ...which would also raise NotifyBanner; its ✕ falls back to the Google
      // Arabic font, and the x-e2e-test header fails that font's CORS preflight.
      localStorage.setItem('hifth:notifyDismissed', '1');
    });
    await reset(page, [seedWird('w-rem', 'Evening wird', 10)]);

    await page.goto('/settings');
    const select = page.getByLabel('Daily wird reminder');
    await expect(select).toHaveValue('18:00'); // the column default
    // Per-device warning, while the time stays editable.
    await expect(page.getByText("Notifications are off on this device, so it won't arrive here.")).toBeVisible();
    await expect(select).toBeEnabled();

    await select.selectOption('07:30');
    await expect(page.getByText('Saving…')).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('Daily wird reminder')).toHaveValue('07:30');

    await page.getByLabel('Daily wird reminder').selectOption('');
    await expect(page.getByText('Saving…')).toHaveCount(0);
    await page.reload();
    await expect(page.getByLabel('Daily wird reminder')).toHaveValue('');
    // Off: nothing to warn about.
    await expect(page.getByText(/so it won't arrive here/)).toHaveCount(0);

    await setReminder(page, '18:00'); // the mock profile outlives the test
  });

  test('settings: with no wirds the reminder is dimmed and says what to do', async ({ page }) => {
    guardConsole(page);
    await reset(page, []);
    await page.goto('/settings');
    await expect(page.getByLabel('Daily wird reminder')).toBeDisabled();
    await expect(page.getByText('Create a wird to use this.')).toBeVisible();
  });

  test('sheet: offered after the first wird; Not now turns the reminder off, once per device', async ({ page }) => {
    guardConsole(page);
    // Headless Chromium reports 'denied' and can't show the native prompt; stand
    // in for a browser that hasn't asked yet, which is when the sheet offers.
    await page.addInitScript(() => {
      Object.defineProperty(Notification, 'permission', { get: () => 'default' });
      // ...which would also raise NotifyBanner; its ✕ falls back to the Google
      // Arabic font, and the x-e2e-test header fails that font's CORS preflight.
      localStorage.setItem('hifth:notifyDismissed', '1');
    });
    await reset(page, []);
    await page.goto('/wird');

    const create = async (name: string) => {
      const dialog = page.getByRole('dialog', { name: 'New wird' });
      await dialog.getByLabel('Name').fill(name);
      await dialog.getByRole('spinbutton', { name: 'Last page' }).fill('10');
      await dialog.getByRole('button', { name: 'Create' }).click();
    };
    await page.getByRole('button', { name: 'New wird' }).first().click();
    await create('First wird');

    const sheet = page.getByTestId('reminder-sheet');
    await expect(sheet.getByRole('heading', { name: 'Remind you each evening?' })).toBeVisible({ timeout: 15000 });
    // The time can be moved on the spot, in 15-minute steps.
    await expect(sheet.getByRole('button', { name: /^Remind me at 6:00\s?PM$/ })).toBeVisible();
    await sheet.getByRole('button', { name: 'Change' }).click();
    await sheet.getByRole('button', { name: 'Later' }).click();
    await expect(sheet.getByRole('button', { name: /^Remind me at 6:15\s?PM$/ })).toBeVisible();

    const saved = page.waitForResponse((r) => r.request().method() === 'POST');
    await sheet.getByRole('button', { name: 'Not now' }).click();
    await expect(sheet).toHaveCount(0);
    await saved;

    // Outcome: the account reminder is off, not just the sheet closed.
    await page.goto('/settings');
    await expect(page.getByLabel('Daily wird reminder')).toHaveValue('');

    // Once per device: deleting back to zero and creating again doesn't re-ask.
    await reset(page, []);
    await page.goto('/wird');
    await page.getByRole('button', { name: 'New wird' }).first().click();
    await create('Second first wird');
    await expect(page.getByText('10 pages to go')).toHaveCount(1);
    await expect(sheet).toHaveCount(0);

    await setReminder(page, '18:00');
  });
});
