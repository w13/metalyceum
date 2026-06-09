import { expect, test } from '@playwright/test';

test('loads app shell and emits diagnostics artifact', async ({
  page,
}, testInfo) => {
  const diagnostics: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      diagnostics.push(`[console.${message.type()}] ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    diagnostics.push(`[pageerror] ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    diagnostics.push(
      `[requestfailed] ${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'unknown'}`,
    );
  });

  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#login-overlay')).toBeVisible();
  await expect(page).toHaveTitle(/Metalyceum/i);

  const pageErrors = diagnostics.filter((entry) =>
    entry.startsWith('[pageerror]'),
  );
  expect(pageErrors).toEqual([]);

  await testInfo.attach('diagnostics', {
    body: Buffer.from(JSON.stringify({ diagnostics }, null, 2)),
    contentType: 'application/json',
  });
});
