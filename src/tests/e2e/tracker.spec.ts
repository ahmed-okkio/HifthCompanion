import { test, expect, type BrowserContext } from '@playwright/test';

// Tracker M1 — teacher create + open flow against the mock Supabase client.
// One authenticated mock user (teacher of the halaqat they create).
test.describe('Progression Tracker (Authenticated)', () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([
      { name: 'sb-access-token', value: 'dummy-token', domain: 'localhost', path: '/' },
    ]);
    await context.setExtraHTTPHeaders({ 'x-e2e-test': 'true' });
  });

  test('create a halaqah and open its teacher view', async ({ page }) => {
    // Fail on any browser console error (AGENTS.md strict error policy).
    page.on('console', (msg) => {
      if (msg.type() === 'error') throw new Error(`console error: ${msg.text()}`);
    });

    await page.goto('/tracker');
    await expect(page.locator('h1')).toContainText('Progress Tracker');

    const name = `Fajr Circle ${Date.now()}`;
    await page.getByPlaceholder('Create halaqah').fill(name);
    await page.getByRole('button', { name: 'Create halaqah' }).click();

    // Appears under "Halaqat I teach" as a card link.
    const card = page.getByRole('link', { name: new RegExp(name) });
    await expect(card).toBeVisible();

    // Open it → teacher view shows the invite code + roster.
    await card.click();
    await expect(page).toHaveURL(/\/tracker\/[^/]+$/);
    await expect(page.getByText('Invite code')).toBeVisible();
    await expect(page.getByText('Roster')).toBeVisible();
    await expect(page.getByText('No students yet')).toBeVisible();
  });

  test('language switcher flips to Arabic + RTL', async ({ page }) => {
    await page.goto('/tracker');
    await page.getByLabel('Language').selectOption('ar');
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  });
});

// Two-actor flow — teacher (default mock identity) + a distinct student identity.
// Each Playwright context carries its own sb-auth-token {"sub": uuid}; the mock
// client resolves the acting user from it, so one process serves both roles.
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
  test('student logs → teacher grades → student analytics reflect it', async ({ browser }) => {
    const teacherCtx = await makeActor(browser, TEACHER_ID);
    const studentCtx = await makeActor(browser, STUDENT_ID);

    // Reset the server-side mock store so the run is deterministic.
    await teacherCtx.request.post('/api/test/tracker', { data: { reset: true } });

    // 1) Teacher creates a halaqah and opens its teacher view.
    const teacher = await teacherCtx.newPage();
    await teacher.goto('/tracker');
    const name = `Two Actor ${Date.now()}`;
    await teacher.getByPlaceholder('Create halaqah').fill(name);
    await teacher.getByRole('button', { name: 'Create halaqah' }).click();
    const card = teacher.getByRole('link', { name: new RegExp(name) });
    await expect(card).toBeVisible();
    await card.click();
    await expect(teacher).toHaveURL(/\/tracker\/[^/]+$/);
    const halaqahId = teacher.url().split('/').pop()!;
    await expect(teacher.getByText('Invite code')).toBeVisible();
    const inviteCode = (await teacher.locator('code').first().innerText()).trim();
    expect(inviteCode.length).toBeGreaterThan(0);

    // 2) Student joins by code, then opens the enrolled halaqah.
    const student = await studentCtx.newPage();
    await student.goto('/tracker');
    await student.getByPlaceholder('Invite code').fill(inviteCode);
    await student.getByRole('button', { name: 'Join with code' }).click();
    const enrolled = student.getByRole('link', { name: new RegExp(name) });
    await expect(enrolled).toBeVisible();
    await enrolled.click();
    await expect(student).toHaveURL(new RegExp(`/tracker/${halaqahId}$`));

    // 3) Student logs progress (defaults: Sabaq, p1, Done).
    await student.getByRole('button', { name: 'Submit' }).click();
    await expect(student.getByText(/Sabaq/).first()).toBeVisible();

    // 4) Teacher reloads → sees pending review + grades it.
    await teacher.goto(`/tracker/${halaqahId}`);
    await expect(teacher.getByText('pending review').first()).toBeVisible();
    await teacher.getByRole('button', { name: 'Mark reviewed' }).first().click();
    await expect(teacher.getByText(/^Reviewed/).first()).toBeVisible();

    // 5) Teacher opens the student profile → analytics reflect graded log.
    const roster = teacher.getByRole('link', { name: new RegExp(STUDENT_ID.slice(0, 8)) });
    await roster.first().click();
    await expect(teacher).toHaveURL(new RegExp(`/student/[^/]+$`));
    await expect(teacher.getByText(/Sabaq/).first()).toBeVisible();
    await expect(teacher.getByText(/Reviewed/).first()).toBeVisible();

    await teacherCtx.close();
    await studentCtx.close();
  });
});
