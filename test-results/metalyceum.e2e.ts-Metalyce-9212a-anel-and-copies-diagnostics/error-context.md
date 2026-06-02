# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: metalyceum.e2e.ts >> Metalyceum Behavioral Tests >> completes login, toggles debug panel, and copies diagnostics
- Location: e2e/metalyceum.e2e.ts:23:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.click: Test timeout of 60000ms exceeded.
Call log:
  - waiting for locator('#debug-icon-btn')
    - locator resolved to <button type="button" title="Debug" id="debug-icon-btn" aria-label="Debug panel" class="hud-icon-square glass">…</button>
  - attempting click action
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic:
    - generic:
      - paragraph: Opening Metalyceum...
  - generic:
    - generic [ref=e5]:
      - button "Music player" [ref=e6] [cursor=pointer]:
        - generic [ref=e7]: 🎵
        - generic [ref=e8]: Music
      - button "Event board" [ref=e9] [cursor=pointer]:
        - generic [ref=e10]: 📅
        - generic [ref=e11]: Events
      - button "World editor" [ref=e12] [cursor=pointer]:
        - generic [ref=e13]: 🛠️
        - generic [ref=e14]: Editor
      - button "Debug panel" [ref=e15] [cursor=pointer]:
        - generic [ref=e16]: 🐞
        - generic [ref=e17]: Debug
    - generic [ref=e18]:
      - generic [ref=e20]:
        - generic [ref=e21]: Show
        - button "All" [ref=e22] [cursor=pointer]
        - button "Global" [ref=e23] [cursor=pointer]
        - button "Room" [ref=e24] [cursor=pointer]
      - generic [ref=e25]:
        - generic [ref=e26]: Welcome to Metalyceum. Walk through rooms, chat with others, and open live events together.
        - generic [ref=e27]:
          - generic [ref=e28]: Global
          - generic [ref=e29]: "Alice:"
          - generic [ref=e30]: Hi Bob, can you hear me?
        - generic [ref=e31]:
          - generic [ref=e32]: Global
          - generic [ref=e33]: "Bob:"
          - generic [ref=e34]: Yes Alice, loud and clear!
        - generic [ref=e35]:
          - generic [ref=e36]: Global
          - generic [ref=e37]: "Alice:"
          - generic [ref=e38]: Hello world from test suite!
        - generic [ref=e39]:
          - generic [ref=e40]: Global
          - generic [ref=e41]: "Alice:"
          - generic [ref=e42]: Hello world from test suite!
        - generic [ref=e43]:
          - generic [ref=e44]: Global
          - generic [ref=e45]: "Alice:"
          - generic [ref=e46]: Hi Bob, can you hear me?
        - generic [ref=e47]:
          - generic [ref=e48]: Global
          - generic [ref=e49]: "Bob:"
          - generic [ref=e50]: Yes Alice, loud and clear!
        - generic [ref=e51]:
          - generic [ref=e52]: Global
          - generic [ref=e53]: "Alice:"
          - generic [ref=e54]: Hi Bob, can you hear me?
        - generic [ref=e55]:
          - generic [ref=e56]: Global
          - generic [ref=e57]: "Bob:"
          - generic [ref=e58]: Yes Alice, loud and clear!
        - generic [ref=e59]:
          - generic [ref=e60]: Global
          - generic [ref=e61]: "Alice:"
          - generic [ref=e62]: Hello world from test suite!
        - generic [ref=e63]:
          - generic [ref=e64]: Global
          - generic [ref=e65]: "Alice:"
          - generic [ref=e66]: Hi Bob, can you hear me?
        - generic [ref=e67]:
          - generic [ref=e68]: Global
          - generic [ref=e69]: "Bob:"
          - generic [ref=e70]: Yes Alice, loud and clear!
        - generic [ref=e71]:
          - generic [ref=e72]: Global
          - generic [ref=e73]: "Alice:"
          - generic [ref=e74]: Hello world from test suite!
        - generic [ref=e75]:
          - generic [ref=e76]: Global
          - generic [ref=e77]: "Alice:"
          - generic [ref=e78]: Hello world from test suite!
        - generic [ref=e79]:
          - generic [ref=e80]: Global
          - generic [ref=e81]: "Alice:"
          - generic [ref=e82]: Hello world from test suite!
        - generic [ref=e83]:
          - generic [ref=e84]: Global
          - generic [ref=e85]: "Alice:"
          - generic [ref=e86]: Hi Bob, can you hear me?
        - generic [ref=e87]:
          - generic [ref=e88]: Global
          - generic [ref=e89]: "Bob:"
          - generic [ref=e90]: Yes Alice, loud and clear!
      - generic [ref=e91]:
        - textbox "Message everyone in Metalyceum..." [ref=e92]
        - button "Send" [ref=e93] [cursor=pointer]
    - generic [ref=e94]:
      - button "✕" [ref=e95] [cursor=pointer]
      - generic [ref=e96]:
        - heading "Room" [level=2] [ref=e97]
        - text: 1 / 10 Players
      - generic [ref=e99]: Idle
      - button "📺 Open Theater Mode" [ref=e103] [cursor=pointer]:
        - generic [ref=e104]: 📺 Open Theater Mode
      - generic [ref=e105]:
        - heading "Players in Room" [level=3] [ref=e106]
        - list [ref=e107]
      - button "Edit Room Event" [ref=e109] [cursor=pointer]
  - generic [ref=e110]:
    - generic [ref=e111]:
      - generic [ref=e112]: W
      - generic [ref=e113]: A
      - generic [ref=e114]: S
      - generic [ref=e115]: D
      - generic [ref=e116]: Move
    - generic [ref=e117]:
      - generic [ref=e118]: Space
      - generic [ref=e119]: Jump
    - generic [ref=e120]:
      - generic [ref=e121]: ▲
      - generic [ref=e122]: ▼
      - generic [ref=e123]: ◀
      - generic [ref=e124]: ▶
      - generic [ref=e125]: Orbit Camera
    - generic [ref=e126]:
      - generic [ref=e127]: Drag Mouse
      - generic [ref=e128]: Rotate Camera
    - generic [ref=e129]:
      - generic [ref=e130]: Scroll
      - generic [ref=e131]: Zoom
    - generic [ref=e132]:
      - generic [ref=e133]: "`"
      - generic [ref=e134]: Toggle Debug
    - generic [ref=e135]:
      - generic [ref=e136]: M
      - generic [ref=e137]: Toggle Map
  - dialog:
    - generic:
      - button: ✕
      - generic:
        - heading [level=2]: Theater Mode
      - generic:
        - paragraph: Press Esc or click outside to close.
        - button: Close
  - generic [ref=e139]:
    - generic [ref=e140]:
      - generic [ref=e141]: OTIS
      - generic [ref=e142]: ELEVATOR CO.
    - generic [ref=e143]:
      - generic [ref=e144]: G
      - generic [ref=e145]: FLOOR
    - generic [ref=e146]:
      - button [ref=e147] [cursor=pointer]:
        - generic [ref=e148]: ▲
      - button [ref=e149] [cursor=pointer]:
        - generic [ref=e150]: ▼
    - generic [ref=e151]:
      - generic [ref=e152]: PUSH
      - generic [ref=e153]: TO
      - generic [ref=e154]: CALL
```

# Test source

```ts
  1   | import { expect, test } from "@playwright/test";
  2   | 
  3   | test.describe("Metalyceum Behavioral Tests", () => {
  4   |   // Helper to ensure stable connection before interacting
  5   |   async function loginAndConnect(page, username = "TestUser") {
  6   |     await page.goto("/");
  7   |     await page.fill("#username-input", username);
  8   |     await page.fill("#color-input", "#3b82f6");
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
> 31  |     await debugBtn.click();
      |                    ^ Error: locator.click: Test timeout of 60000ms exceeded.
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
  109 |     await expect(bobPage.locator("#login-overlay")).not.toBeVisible();
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
```