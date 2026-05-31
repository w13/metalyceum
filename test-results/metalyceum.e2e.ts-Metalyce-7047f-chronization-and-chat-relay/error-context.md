# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: metalyceum.e2e.ts >> Metalyceum Behavioral Tests >> handles multi-user synchronization and chat relay
- Location: e2e/metalyceum.e2e.ts:92:7

# Error details

```
Error: expect(locator).not.toBeVisible() failed

Locator:  locator('#login-overlay')
Expected: not visible
Received: visible
Timeout:  5000ms

Call log:
  - Expect "not toBeVisible" with timeout 5000ms
  - waiting for locator('#login-overlay')
    3 × locator resolved to <div id="login-overlay" class="overlay active">…</div>
      - unexpected value "visible"

```

```yaml
- heading "METALYCEUM" [level=1]
- paragraph: A shared 3D world for live rooms, Meet sessions, and YouTube Live watch parties.
- text: Choose Display Name
- textbox "Choose Display Name":
  - /placeholder: e.g. Waqqas
  - text: Bob
- text: Shirt Color
- textbox "Shirt Color": "#3b82f6"
- text: "#3b82f6"
- button "Enter Metalyceum"
- paragraph: 🎵 Welcome Threshold — playing
```

# Test source

```ts
  9   |     await page.click("button[type='submit']");
  10  |     
  11  |     // Wait for login screen to disappear
  12  |     await expect(page.locator("#login-overlay")).not.toBeVisible();
  13  |     
  14  |     // Wait for connection status dot to be marked connected
  15  |     const statusDot = page.locator("#connection-status");
  16  |     await expect(statusDot).toHaveClass(/connected/);
  17  |     
  18  |     // Wait for initial room connection to settle and chat logs to load
  19  |     await expect(page.locator("#chat-log")).toContainText("Welcome to Metalyceum");
  20  |     await page.waitForTimeout(2000); 
  21  |   }
  22  | 
  23  |   test("completes login, toggles debug panel, and copies diagnostics", async ({ page, context }) => {
  24  |     await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  25  | 
  26  |     await loginAndConnect(page);
  27  | 
  28  |     // Toggle Debug Panel
  29  |     const debugBtn = page.locator("#debug-icon-btn");
  30  |     await expect(debugBtn).toBeVisible();
  31  |     await debugBtn.click();
  32  | 
  33  |     // Verify debug panel is shown
  34  |     const debugPanel = page.locator("#debug-panel");
  35  |     await expect(debugPanel).toHaveAttribute("aria-hidden", "false");
  36  | 
  37  |     // Verify coordinate displays exist
  38  |     const playerPos = page.locator("#debug-player-pos");
  39  |     await expect(playerPos).toContainText(/X:/);
  40  | 
  41  |     // Test clipboard copy
  42  |     const copyBtn = page.locator("#copy-debug-btn");
  43  |     await copyBtn.click();
  44  | 
  45  |     // Read from clipboard and assert it contains diagnostics details
  46  |     const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  47  |     expect(clipboardText).toContain("Diagnostics Report");
  48  |     expect(clipboardText).toContain("X:");
  49  |   });
  50  | 
  51  |   test("sends chat message and verifies it appears in chat logs", async ({ page }) => {
  52  |     await loginAndConnect(page, "Alice");
  53  | 
  54  |     // Fill chat
  55  |     const chatInput = page.locator("#chat-input");
  56  |     await expect(chatInput).toBeVisible();
  57  |     await page.fill("#chat-input", "Hello world from test suite!");
  58  |     await page.press("#chat-input", "Enter");
  59  | 
  60  |     // Verify message appears in log
  61  |     const chatLog = page.locator("#chat-log");
  62  |     await expect(chatLog).toContainText("Alice");
  63  |     await expect(chatLog).toContainText("Hello world from test suite!");
  64  |   });
  65  | 
  66  |   test("simulates keyboard inputs and updates player position coordinates", async ({ page }) => {
  67  |     await loginAndConnect(page);
  68  | 
  69  |     // Click the game container to focus the viewport and blur any active text inputs
  70  |     await page.click("#game-container");
  71  | 
  72  |     // Open debug panel to read coordinates
  73  |     await page.click("#debug-icon-btn");
  74  |     const playerPos = page.locator("#debug-player-pos");
  75  | 
  76  |     // Get initial coordinates
  77  |     const initialText = await playerPos.textContent();
  78  |     
  79  |     // Simulate walking forward: press W key down and hold it
  80  |     await page.keyboard.down("w");
  81  |     await page.waitForTimeout(1500); // hold for 1.5s to allow movement physics to update X/Z
  82  |     await page.keyboard.up("w");
  83  | 
  84  |     // Wait a brief moment for the rendering/UI thread to update
  85  |     await page.waitForTimeout(300);
  86  | 
  87  |     // Get new coordinates and verify they changed
  88  |     const currentText = await playerPos.textContent();
  89  |     expect(currentText).not.toEqual(initialText);
  90  |   });
  91  | 
  92  |   test("handles multi-user synchronization and chat relay", async ({ browser }) => {
  93  |     test.setTimeout(90_000);
  94  |     // Create Alice context and page
  95  |     const aliceContext = await browser.newContext();
  96  |     const alicePage = await aliceContext.newPage();
  97  |     await alicePage.goto("/");
  98  |     await alicePage.fill("#username-input", "Alice");
  99  |     await alicePage.click("button[type='submit']");
  100 |     await expect(alicePage.locator("#login-overlay")).not.toBeVisible();
  101 |     await expect(alicePage.locator("#connection-status")).toHaveClass(/connected/);
  102 | 
  103 |     // Create Bob context and page
  104 |     const bobContext = await browser.newContext();
  105 |     const bobPage = await bobContext.newPage();
  106 |     await bobPage.goto("/");
  107 |     await bobPage.fill("#username-input", "Bob");
  108 |     await bobPage.click("button[type='submit']");
> 109 |     await expect(bobPage.locator("#login-overlay")).not.toBeVisible();
      |                                                         ^ Error: expect(locator).not.toBeVisible() failed
  110 |     await expect(bobPage.locator("#connection-status")).toHaveClass(/connected/);
  111 | 
  112 |     // Settle both connections
  113 |     await alicePage.waitForTimeout(2000);
  114 |     await bobPage.waitForTimeout(2000);
  115 | 
  116 |     // Alice sends a message to Bob
  117 |     await alicePage.fill("#chat-input", "Hi Bob, can you hear me?");
  118 |     await alicePage.press("#chat-input", "Enter");
  119 | 
  120 |     // Bob should receive Alice's message in the chat log
  121 |     const bobChatLog = bobPage.locator("#chat-log");
  122 |     await expect(bobChatLog).toContainText("Alice");
  123 |     await expect(bobChatLog).toContainText("Hi Bob, can you hear me?");
  124 | 
  125 |     // Bob replies
  126 |     await bobPage.fill("#chat-input", "Yes Alice, loud and clear!");
  127 |     await bobPage.press("#chat-input", "Enter");
  128 | 
  129 |     // Alice should receive Bob's message
  130 |     const aliceChatLog = alicePage.locator("#chat-log");
  131 |     await expect(aliceChatLog).toContainText("Bob");
  132 |     await expect(aliceChatLog).toContainText("Yes Alice, loud and clear!");
  133 | 
  134 |     // Clean up
  135 |     await aliceContext.close();
  136 |     await bobContext.close();
  137 |   });
  138 | });
  139 | 
```