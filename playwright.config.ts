import { defineConfig, devices } from '@playwright/test';

// E2E runs against a production build on its own port: `next dev` recompiles
// routes mid-run and stalls 10-100s per request under parallel workers.
const PORT = 3100;

const desktop = {
  ...devices['Desktop Chrome'],
  storageState: 'playwright/.auth/user.json',
};

// Impact areas: run one with `npm run test:e2e:<area>` (= `playwright test --project=<area>`).
const areas: Record<string, RegExp> = {
  annotations: /(annotations|features|persistence)\.spec\.ts/,
  reader: /(reader_nav|surah_panel|surah_panel_screenshot)\.spec\.ts/,
  sets: /sets\.spec\.ts/,
  tracker: /tracker\.spec\.ts/,
  wird: /wird\.spec\.ts/,
};

export default defineConfig({
  testDir: './src/tests/e2e',
  // retries: 1 is a backstop for slow-FS timing jitter; the primary fix is in the draw helpers.
  retries: 1,
  use: {
    baseURL: `http://localhost:${PORT}`,
    browserName: 'chromium',
    // The browser's zone becomes profiles.timezone (I18nProvider), which decides
    // the wird day (D20). Pin it so seeded UTC dates mean the same day on every
    // machine; zone maths is covered by src/tests/wirdReminder.test.ts.
    timezoneId: 'UTC',
    extraHTTPHeaders: {
      'x-e2e-test': 'true',
    },
  },
  webServer: {
    command: `npm run build && npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: {
      PLAYWRIGHT_TEST: 'true',
    },
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    ...Object.entries(areas).map(([name, testMatch]) => ({
      name,
      use: desktop,
      dependencies: ['setup'],
      testMatch,
    })),
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
