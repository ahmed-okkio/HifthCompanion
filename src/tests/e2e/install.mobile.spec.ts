import { test, expect, type Page } from '@playwright/test';

const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

async function failOnConsoleError(page: Page) {
  // The Google-hosted Arabic font fails CORS preflight under the suite-wide
  // x-e2e-test header (harness artifact, not an app bug); stub it as wird.spec does.
  await page.route('https://fonts.gstatic.com/**', (r) =>
    r.fulfill({ status: 200, body: '', headers: { 'access-control-allow-origin': '*' } }));
  page.on('console', msg => {
    if (msg.type() === 'error') throw new Error(msg.text());
  });
}

test('Android without install event shows browser-menu steps', async ({ page }) => {
  await failOnConsoleError(page);
  await page.goto('/install');
  await expect(page.locator('main[data-view="android"]')).toBeVisible();
  await expect(page.getByText('Open your browser menu')).toBeVisible();
});

test('beforeinstallprompt shows Install button that triggers the native prompt', async ({ page }) => {
  await failOnConsoleError(page);
  await page.goto('/install');
  await expect(page.locator('main[data-view="android"]')).toBeVisible();
  await page.evaluate(() => {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & Record<string, unknown>;
    e.prompt = async () => { (window as unknown as { prompted: boolean }).prompted = true; };
    e.userChoice = Promise.resolve({ outcome: 'accepted' });
    window.dispatchEvent(e);
  });
  await page.getByRole('button', { name: 'Install' }).click();
  expect(await page.evaluate(() => (window as unknown as { prompted?: boolean }).prompted)).toBe(true);
});

test('iPhone gets the three illustrated Safari steps', async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: IPHONE_UA, viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await failOnConsoleError(page);
  await page.goto('/install');
  await expect(page.locator('main[data-view="ios"]')).toBeVisible();
  await expect(page.locator('main li')).toHaveCount(3);
  await expect(page.getByText('Add to Home Screen', { exact: true }).first()).toBeVisible();
  await ctx.close();
});

test('desktop gets a QR code to the install page', async ({ browser }) => {
  const ctx = await browser.newContext({ userAgent: DESKTOP_UA });
  const page = await ctx.newPage();
  await failOnConsoleError(page);
  await page.goto('/install');
  await expect(page.locator('main[data-view="desktop"] [role="img"] svg')).toBeVisible();
  await ctx.close();
});
