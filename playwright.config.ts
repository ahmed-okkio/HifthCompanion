import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './src/tests/e2e',
  // retries: 1 is a backstop for slow-FS timing jitter; the primary fix is in the draw helpers.
  retries: 1,
  use: {
    baseURL: 'http://localhost:3000',
    browserName: 'chromium',
    extraHTTPHeaders: {
      'x-e2e-test': 'true',
    },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    env: {
      PLAYWRIGHT_TEST: 'true',
    },
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testIgnore: /.*\.mobile\.spec\.ts/,
    },
    {
      name: 'mobile',
      use: {
        ...devices['Pixel 5'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
      testMatch: /.*\.mobile\.spec\.ts/,
    },
  ],
});
