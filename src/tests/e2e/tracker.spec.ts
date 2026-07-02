import { test, expect, type BrowserContext } from '@playwright/test';

// Tracker — teacher create + open flow against the mock Supabase client.
// One authenticated mock user (teacher of the circles they create).
test.describe('Progression Tracker (Authenticated)', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: 'sb-access-token', value: 'dummy-token', domain: 'localhost', path: '/' },
    ]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });
  });

  test('create a circle and open its teacher view', async ({ page }) => {
    // Fail on any browser console error (AGENTS.md strict error policy).
    page.on('console', (msg) => {
      if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`);
    });

    await page.goto('/tracker');
    await expect(page.locator('h1')).toContainText('Progress Tracker');

    const name = `Fajr Circle ${Date.now()}`;
    await page.getByPlaceholder('Name your Hifth Circle…').fill(name);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    // Appears under "Hifth Circles I teach" as a card link.
    const card = page.getByRole('link', { name: new RegExp(name) });
    await expect(card).toBeVisible();

    // Open it → teacher view shows the invite code + roster.
    await card.click();
    await expect(page).toHaveURL(/\/tracker\/[^/]+$/);
    await expect(page.getByText('Invite code')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Students' })).toBeVisible();
    await expect(page.getByText('No students yet')).toBeVisible();
  });

  test('language switcher flips to Arabic + RTL', async ({ page }) => {
    await page.goto('/tracker');
    // The switcher now lives inside the account menu dropdown — open it first.
    await page.getByRole('button', { name: 'Account menu' }).click();
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
    await teacherCtx.request.post('/api/test/tracker', { data: { reset: true } });

    // 1) Teacher creates a circle and opens its teacher view.
    const teacher = await teacherCtx.newPage();
    await teacher.goto('/tracker');
    const name = `Two Actor ${Date.now()}`;
    await teacher.getByPlaceholder('Name your Hifth Circle…').fill(name);
    await teacher.getByRole('button', { name: 'Create', exact: true }).click();
    const card = teacher.getByRole('link', { name: new RegExp(name) });
    await expect(card).toBeVisible();
    await card.click();
    await expect(teacher).toHaveURL(/\/tracker\/[^/]+$/);
    const circleId = teacher.url().split('/').pop()!;
    await expect(teacher.getByText('Invite code')).toBeVisible();
    await expect(teacher.getByText('No students yet')).toBeVisible(); // C1: empty roster
    const inviteCode = (await teacher.locator('code').first().innerText()).trim();
    expect(inviteCode.length).toBeGreaterThan(0);

    // 2) Student joins by code → lands on the ACCEPT screen (C3/C4): a code visit
    //    does NOT silently create an active membership.
    const student = await studentCtx.newPage();
    await student.goto('/tracker');
    await student.getByPlaceholder('Invite code').fill(inviteCode);
    await student.getByRole('button', { name: 'Join', exact: true }).click();
    await expect(student).toHaveURL(new RegExp(`/tracker/${circleId}$`));
    // Accept screen names the join + the teacher's mushaf visibility.
    await expect(student.getByText('Join this Hifth Circle')).toBeVisible();
    await expect(student.getByRole('button', { name: 'Accept & join' })).toBeVisible();

    // 3) Accepting flips the membership to active → student self-service view.
    await student.getByRole('button', { name: 'Accept & join' }).click();
    await expect(student.getByText('Log today')).toBeVisible();

    // 4) After accept, the student appears ACTIVE in the teacher roster (C5) and is
    //    clickable into their profile.
    await teacher.goto(`/tracker/${circleId}`);
    const roster = teacher.getByRole('link', { name: new RegExp(STUDENT_ID.slice(0, 6)) });
    await expect(roster.first()).toBeVisible();
    await roster.first().click();
    await expect(teacher).toHaveURL(new RegExp(`/student/[^/]+$`));
    await expect(teacher.getByRole('button', { name: 'Prescribe homework' })).toBeVisible();

    // 5) Open self-submission (F1): student logs with a fixed type, no prescription.
    await student.getByRole('button', { name: 'Submit' }).click();
    // The new log row reads "Memorization · p1–1" (the bare word also appears in the
    // type <option>, so match the row's page-range suffix to disambiguate).
    await expect(student.getByText(/Memorization\s*·\s*p/).first()).toBeVisible();

    await teacherCtx.close();
    await studentCtx.close();
  });
});
