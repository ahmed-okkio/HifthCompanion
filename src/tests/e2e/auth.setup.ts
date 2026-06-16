import { test as setup } from '@playwright/test';

setup('authenticate', async ({ page, context }) => {
  // Inject a mock auth cookie directly into the context, so middleware picks it up
  // Ensure the user ID is a valid UUID
  const mockUserId = '52345ff6-3348-40d5-b6d8-1234567890ab';
  await context.addCookies([
    {
      name: 'sb-auth-token', // Adjusted token name to match common convention
      value: JSON.stringify({ sub: mockUserId }), // Simplified mock
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false, // Localhost is not secure
    },
  ]);

  // Save auth state
  await page.context().storageState({ path: 'playwright/.auth/user.json' });
});
