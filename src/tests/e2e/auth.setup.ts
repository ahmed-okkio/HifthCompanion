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

  // Save auth state
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
