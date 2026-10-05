import { test, expect, type BrowserContext } from '@playwright/test';

// Only this spec's tables: other specs share the server mock store in parallel.
const TRACKER_TABLES = ['circle', 'membership', 'progress_log', 'session', 'homework', 'membership_note', 'agenda_item', 'exam'];

// Tracker — teacher create + open flow against the mock Supabase client.
// One authenticated mock user (teacher of the circles they create).
test.describe('Progression Tracker (Authenticated)', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: 'sb-access-token', value: 'dummy-token', domain: 'localhost', path: '/' },
    ]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });
    // Start with no circles so /tracker shows the empty state (it redirects to the
    // first circle otherwise) and the rail "+" create flow is exercised deterministically.
    await context.request.post('/api/test/tracker', { data: { reset: TRACKER_TABLES } });
  });

  test('create a circle and open its teacher view', async ({ page }) => {
    // Fail on any browser console error (AGENTS.md strict error policy).
    page.on('console', (msg) => {
      if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`);
    });

    await page.goto('/tracker');
    // No circles yet → empty state; create one via the rail "+".
    await expect(page.getByText('No circles yet')).toBeVisible();

    const name = `Fajr Circle ${Date.now()}`;
    await page.getByRole('button', { name: 'Create Hifth Circle' }).click();
    await page.getByPlaceholder('Name your Hifth Circle…').fill(name);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Creating switches straight into the new circle's teacher view.
    await expect(page).toHaveURL(/\/tracker\/[^/]+$/);
    await expect(page.getByText('Invite link')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible();
    await expect(page.getByText('No students yet')).toBeVisible();
  });

  test('programmatic navigation (circle rail router.push) drives the top progress bar', async ({ page }) => {
    page.on('console', (msg) => {
      if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`);
    });

    await page.goto('/tracker');
    const create = async (name: string) => {
      await page.getByRole('button', { name: 'Create Hifth Circle' }).click();
      await page.getByPlaceholder('Name your Hifth Circle…').fill(name);
      // The circle page has its own (disabled) "Create" button; target the dialog's.
      await page.getByRole('button', { name: 'Create', exact: true }).and(page.locator(':enabled')).click();
      await expect(page).toHaveURL(/\/tracker\/[^/]+$/, { timeout: 15000 });
    };
    const stamp = Date.now();
    await create(`Rail A ${stamp}`);
    const urlA = page.url();
    await create(`Rail B ${stamp}`);
    await expect(page).not.toHaveURL(urlA);

    // Hold the RSC navigation response so the slow-server window is observable.
    let release!: () => void;
    const held = new Promise<void>((r) => { release = r; });
    await page.route(/\/tracker\//, async (route) => {
      const h = route.request().headers();
      if (h['rsc'] && !h['next-router-prefetch']) await held;
      await route.continue();
    });

    const bar = page.locator('.top-progress');
    await page.getByRole('button', { name: new RegExp(`^Rail A ${stamp}`) }).click();
    await expect(bar).toHaveClass(/top-progress--active/);
    release();
    await expect(page).toHaveURL(urlA);
    await expect(bar).not.toHaveClass(/top-progress--active/);
  });

  test('language switcher flips to Arabic + RTL', async ({ page }) => {
    await page.goto('/tracker');
    // The switcher now lives inside the account menu dropdown — open it first.
    await page.getByRole('button', { name: 'Account' }).click();
    await page.getByLabel('Language').selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });
});

// Two-actor flow — teacher (default mock identity) + a distinct student identity.
// Each Playwright context carries its own sb-auth-token {"sub": uuid}; the mock
// server client resolves the acting user from it, so one process serves both roles.
// NOTE: the mock does NOT enforce RLS — it only exercises the *UI flow* driven by
// real membership.status data (pending→accept→active). Security/consent isolation
// (C2, S1–S6, G4) are RLS guarantees and are NOT covered here — DB-only.
const TEACHER_ID = '52345ff6-3348-40d5-b6d8-1234567890ab';
const STUDENT_ID = '6a1b2c3d-4e5f-6789-abcd-0123456789ef';

async function makeActor(
  browser: import('@playwright/test').Browser,
  sub: string,
): Promise<BrowserContext> {
  const ctx = await browser.newContext({ extraHTTPHeaders: { 'x-e2e-test': 'true' } });
  await ctx.addCookies([
    { name: 'sb-auth-token', value: JSON.stringify({ sub }), domain: 'localhost', path: '/' },
    { name: 'x-e2e-test', value: 'true', domain: 'localhost', path: '/' },
  ]);
  return ctx;
}

test.describe('Progression Tracker (Two-actor)', () => {
  test('consent gate + open submission: join → accept → active roster → student logs', async ({ browser }) => {
    const teacherCtx = await makeActor(browser, TEACHER_ID);
    const studentCtx = await makeActor(browser, STUDENT_ID);

    // Reset the server-side mock store so the run is deterministic.
    await teacherCtx.request.post('/api/test/tracker', { data: { reset: TRACKER_TABLES } });

    // 1) Teacher creates a circle and opens its teacher view.
    const teacher = await teacherCtx.newPage();
    await teacher.goto('/tracker');
    const name = `Two Actor ${Date.now()}`;
    await teacher.getByRole('button', { name: 'Create Hifth Circle' }).click();
    await teacher.getByPlaceholder('Name your Hifth Circle…').fill(name);
    await teacher.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(teacher).toHaveURL(/\/tracker\/[^/]+$/);
    const circleId = teacher.url().split('/').pop()!;
    await expect(teacher.getByText('Invite link')).toBeVisible();
    await expect(teacher.getByText('No students yet')).toBeVisible(); // C1: empty roster
    // The invite <code> shows the full join URL; the code is its last segment.
    const inviteCode = (await teacher.locator('code').first().innerText()).trim().split('/').pop()!;
    expect(inviteCode.length).toBeGreaterThan(0);

    // 2) Student opens the invite link → joins as pending and lands on the ACCEPT
    //    screen (C3/C4): visiting the link does NOT silently create an active membership.
    const student = await studentCtx.newPage();
    await student.goto(`/tracker/join/${inviteCode}`);
    await expect(student).toHaveURL(new RegExp(`/tracker/${circleId}$`));
    // Accept screen names the join + the teacher's mushaf visibility.
    await expect(student.getByText('Join this Hifth Circle')).toBeVisible();
    await expect(student.getByRole('button', { name: 'Accept & join' })).toBeVisible();

    // 3) Accepting flips the membership to active → student self-service view.
    await student.getByRole('button', { name: 'Accept & join' }).click();
    await student.getByRole('tab', { name: 'Log' }).click();
    await expect(student.getByRole('button', { name: 'Log today' })).toBeVisible();
    // The active tab's 2px underline is painted, not clipped by the strip's overflow.
    const underline = await student.getByRole('tab', { name: 'Log' }).evaluate((tab) => {
      const r = tab.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.bottom - 1);
      return { hitsTab: hit === tab || tab.contains(hit), width: getComputedStyle(tab).borderBottomWidth };
    });
    expect(underline).toEqual({ hitsTab: true, width: '2px' });

    // 4) After accept, the student appears ACTIVE in the teacher roster (C5) and is
    //    clickable into their profile.
    await teacher.goto(`/tracker/${circleId}`);
    const roster = teacher.getByRole('link', { name: new RegExp(STUDENT_ID.slice(0, 6)) });
    await expect(roster.first()).toBeVisible();
    await roster.first().click();
    await expect(teacher).toHaveURL(new RegExp(`/student/[^/]+$`));
    await teacher.getByRole('tab', { name: 'Homework' }).click();
    await expect(teacher.getByRole('button', { name: 'Prescribe homework' })).toBeVisible();

    // 5) Open self-submission (F1): student logs with a fixed type, no prescription.
    await student.getByRole('button', { name: 'Log today' }).click();
    // The picker defaults to all of Al-Faatiha; Add it as the log's one entry.
    await student.getByRole('button', { name: 'Add', exact: true }).click();
    await student.getByRole('button', { name: 'Submit' }).click();
    // The new log row reads "Memorization · p1–1" (the bare word also appears in the
    // type <option>, so match the row's page-range suffix to disambiguate).
    await expect(student.getByText(/Memorization\s*·\s*p/).first()).toBeVisible();

    // 6) Teacher grades it with the two-way check / cross (no worded labels).
    await teacher.reload();
    await teacher.getByRole('tab', { name: 'Homework' }).click();
    await teacher.getByRole('button', { name: /Memorization\s*·\s*p/ }).first().click();
    await teacher.getByRole('button', { name: 'Pass' }).click();
    await teacher.getByRole('button', { name: 'Mark reviewed' }).click();
    await expect(teacher.getByRole('img', { name: 'Pass' })).toBeVisible();

    // Outcome: the student sees the grade, read back from the server, as a check.
    await student.reload();
    await student.getByRole('tab', { name: 'Log' }).click();
    await expect(student.getByRole('img', { name: 'Pass' })).toBeVisible();

    // 7) To do tab merges exams, homework and new teacher notes, nearest date first;
    //    exams no longer live in the sidebar.
    const membershipId = teacher.url().split('/').pop()!;
    const day = (offset: number) => new Date(Date.now() + offset * 864e5).toLocaleDateString('en-CA');
    const now = new Date().toISOString();
    await teacherCtx.request.post('/api/test/tracker', { data: { seed: {
      homework: [{ id: 'hw-todo', membership_id: membershipId, prescribed_by: TEACHER_ID, group_id: null,
        type: 'memorization', deadline: day(5), page_start: 1, page_end: 1, surah: 1,
        ayah_start: null, ayah_end: null, instructions: null, created_at: now }],
      exam: [{ id: 'ex-todo', membership_id: membershipId, scheduled_date: day(1), page_start: 2, page_end: 2,
        surah: 2, ayah_start: 1, ayah_end: 5, entries: [], status: 'scheduled', teacher_notes: null, created_at: now }],
      membership_note: [{ id: 'note-todo', membership_id: membershipId, author_id: TEACHER_ID,
        body: 'Revise juz amma', created_at: now }],
    } } });
    await student.reload();
    await expect(student.getByRole('tab', { name: 'To do' })).toHaveAttribute('aria-selected', 'true');
    await expect(student.getByText('Exams', { exact: true })).toHaveCount(0);
    const todo = student.locator('.card').filter({ hasText: /New notes from your teacher|Scheduled|Due/ });
    await expect(todo).toHaveCount(3);
    await expect(todo.nth(0)).toContainText('New notes from your teacher');
    await expect(todo.nth(1)).toContainText('Scheduled');
    await expect(todo.nth(2)).toContainText('Due');
    // Opening Notes marks them seen → the item drops off the To do list.
    await todo.nth(0).click();
    await expect(student.getByText('Revise juz amma')).toBeVisible();
    await student.getByRole('tab', { name: 'To do' }).click();
    await expect(student.getByText('New notes from your teacher')).toHaveCount(0);

    await teacherCtx.close();
    await studentCtx.close();
  });
});
