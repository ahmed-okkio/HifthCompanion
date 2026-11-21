import { writeFileSync } from 'node:fs';
import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page, context }) => {
  // Inject a mock auth cookie directly into the context, so middleware picks it up
  // Ensure the user ID is a valid UUID
  const mockUserId = '52345ff6-3348-40d5-b6d8-1234567890ab';
  await context.addCookies([
    {
      name: 'sb-auth-token',
      value: JSON.stringify({ sub: mockUserId }),
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    },
    {
      name: 'x-e2e-test',
      value: 'true',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    }
  ]);

  // Save auth state. Desktop defaults to double page; specs were written against single page,
  // so pin it here (the spread default has its own test in reader_nav.spec.ts).
  const state = await page.context().storageState();
  state.origins = [{ origin: 'http://localhost:3100', localStorage: [{ name: 'reader-spread-mode', value: '0' }] }];
  writeFileSync('playwright/.auth/user.json', JSON.stringify(state));
});
