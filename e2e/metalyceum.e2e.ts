import { expect, test } from '@playwright/test';

test.describe('Metalyceum Behavioral Tests', () => {
  // Helper to ensure stable connection before interacting
  async function loginAndConnect(page, username = 'TestUser') {
    await page.goto('/');
    await page.fill('#username-input', username);
    await page.fill('#color-input', '#3b82f6');
    await page.click("button[type='submit']");

    // Wait for login screen to disappear
    await expect(page.locator('#login-overlay')).not.toBeVisible();

    // Wait for connection status dot to be marked connected
    const statusDot = page.locator('#connection-status');
    await expect(statusDot).toHaveClass(/connected/);

    // Wait for initial room connection to settle and chat logs to load
    await expect(page.locator('#chat-log')).toContainText(
      'Welcome to Metalyceum',
    );
    await page.waitForTimeout(2000);
  }

  test('completes login, toggles debug panel, and copies diagnostics', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    await loginAndConnect(page);

    // Toggle Debug Panel
    const debugBtn = page.locator('#debug-icon-btn');
    await expect(debugBtn).toBeVisible();
    await debugBtn.click();

    // Verify debug panel is shown
    const debugPanel = page.locator('#debug-panel');
    await expect(debugPanel).toHaveAttribute('aria-hidden', 'false');

    // Verify coordinate displays exist
    const playerPos = page.locator('#debug-player-pos');
    await expect(playerPos).toContainText(/X:/);

    // Test clipboard copy
    const copyBtn = page.locator('#copy-debug-btn');
    await copyBtn.click();

    // Read from clipboard and assert it contains diagnostics details
    const clipboardText = await page.evaluate(() =>
      navigator.clipboard.readText(),
    );
    expect(clipboardText).toContain('Diagnostics Report');
    expect(clipboardText).toContain('X:');
  });

  test('sends chat message and verifies it appears in chat logs', async ({
    page,
  }) => {
    await loginAndConnect(page, 'Alice');

    // Fill chat
    const chatInput = page.locator('#chat-input');
    await expect(chatInput).toBeVisible();
    await page.fill('#chat-input', 'Hello world from test suite!');
    await page.press('#chat-input', 'Enter');

    // Verify message appears in log
    const chatLog = page.locator('#chat-log');
    await expect(chatLog).toContainText('Alice');
    await expect(chatLog).toContainText('Hello world from test suite!');
  });

  test('simulates keyboard inputs and updates player position coordinates', async ({
    page,
  }) => {
    await loginAndConnect(page);

    // Click the game container to focus the viewport and blur any active text inputs
    await page.click('#game-container');

    // Open debug panel to read coordinates
    await page.click('#debug-icon-btn');
    const playerPos = page.locator('#debug-player-pos');

    // Get initial coordinates
    const initialText = await playerPos.textContent();

    // Simulate walking forward: press W key down and hold it
    await page.keyboard.down('w');
    await page.waitForTimeout(1500); // hold for 1.5s to allow movement physics to update X/Z
    await page.keyboard.up('w');

    // Wait a brief moment for the rendering/UI thread to update
    await page.waitForTimeout(300);

    // Get new coordinates and verify they changed
    const currentText = await playerPos.textContent();
    expect(currentText).not.toEqual(initialText);
  });

  test('handles multi-user synchronization and chat relay', async ({
    browser,
  }) => {
    test.setTimeout(90_000);
    // Create Alice context and page
    const aliceContext = await browser.newContext();
    const alicePage = await aliceContext.newPage();
    await alicePage.goto('/');
    await alicePage.fill('#username-input', 'Alice');
    await alicePage.click("button[type='submit']");
    await expect(alicePage.locator('#login-overlay')).not.toBeVisible();
    await expect(alicePage.locator('#connection-status')).toHaveClass(
      /connected/,
    );

    // Create Bob context and page
    const bobContext = await browser.newContext();
    const bobPage = await bobContext.newPage();
    await bobPage.goto('/');
    await bobPage.fill('#username-input', 'Bob');
    await bobPage.click("button[type='submit']");
    await expect(bobPage.locator('#login-overlay')).not.toBeVisible();
    await expect(bobPage.locator('#connection-status')).toHaveClass(
      /connected/,
    );

    // Settle both connections
    await alicePage.waitForTimeout(2000);
    await bobPage.waitForTimeout(2000);

    // Alice sends a message to Bob
    await alicePage.fill('#chat-input', 'Hi Bob, can you hear me?');
    await alicePage.press('#chat-input', 'Enter');

    // Bob should receive Alice's message in the chat log
    const bobChatLog = bobPage.locator('#chat-log');
    await expect(bobChatLog).toContainText('Alice');
    await expect(bobChatLog).toContainText('Hi Bob, can you hear me?');

    // Bob replies
    await bobPage.fill('#chat-input', 'Yes Alice, loud and clear!');
    await bobPage.press('#chat-input', 'Enter');

    // Alice should receive Bob's message
    const aliceChatLog = alicePage.locator('#chat-log');
    await expect(aliceChatLog).toContainText('Bob');
    await expect(aliceChatLog).toContainText('Yes Alice, loud and clear!');

    // Clean up
    await aliceContext.close();
    await bobContext.close();
  });
});
