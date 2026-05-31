# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: metalyceum.e2e.ts >> Metalyceum Behavioral Tests >> completes login, toggles debug panel, and copies diagnostics
- Location: e2e/metalyceum.e2e.ts:23:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#debug-player-pos')
Expected pattern: /X:/
Received string:  ""

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('#debug-player-pos')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic:
    - generic:
      - paragraph: Opening Metalyceum...
  - generic:
    - generic [ref=e5]:
      - button "Music player" [ref=e6] [cursor=pointer]:
        - generic [ref=e7]: 🎵
        - generic [ref=e8]: ♪ On
      - button "Event board" [ref=e9] [cursor=pointer]:
        - generic [ref=e10]: 📅
        - generic [ref=e11]: Events
      - button "World editor" [ref=e12] [cursor=pointer]:
        - generic [ref=e13]: 🛠️
        - generic [ref=e14]: Editor
      - button "Debug panel" [active] [ref=e15] [cursor=pointer]:
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
        - generic [ref=e27]: ✅ Reconnected.
        - generic [ref=e28]:
          - generic [ref=e29]: Global
          - generic [ref=e30]: "Alice:"
          - generic [ref=e31]: Hi Bob, can you hear me?
        - generic [ref=e32]:
          - generic [ref=e33]: Global
          - generic [ref=e34]: "Bob:"
          - generic [ref=e35]: Yes Alice, loud and clear!
        - generic [ref=e36]:
          - generic [ref=e37]: Global
          - generic [ref=e38]: "Alice:"
          - generic [ref=e39]: Hello world from test suite!
        - generic [ref=e40]:
          - generic [ref=e41]: Global
          - generic [ref=e42]: "Alice:"
          - generic [ref=e43]: Hello world from test suite!
        - generic [ref=e44]:
          - generic [ref=e45]: Global
          - generic [ref=e46]: "Alice:"
          - generic [ref=e47]: Hi Bob, can you hear me?
        - generic [ref=e48]:
          - generic [ref=e49]: Global
          - generic [ref=e50]: "Bob:"
          - generic [ref=e51]: Yes Alice, loud and clear!
        - generic [ref=e52]:
          - generic [ref=e53]: Global
          - generic [ref=e54]: "Alice:"
          - generic [ref=e55]: Hi Bob, can you hear me?
        - generic [ref=e56]:
          - generic [ref=e57]: Global
          - generic [ref=e58]: "Bob:"
          - generic [ref=e59]: Yes Alice, loud and clear!
        - generic [ref=e60]:
          - generic [ref=e61]: Global
          - generic [ref=e62]: "Alice:"
          - generic [ref=e63]: Hello world from test suite!
        - generic [ref=e64]:
          - generic [ref=e65]: Global
          - generic [ref=e66]: "Alice:"
          - generic [ref=e67]: Hi Bob, can you hear me?
        - generic [ref=e68]:
          - generic [ref=e69]: Global
          - generic [ref=e70]: "Bob:"
          - generic [ref=e71]: Yes Alice, loud and clear!
        - generic [ref=e72]:
          - generic [ref=e73]: Global
          - generic [ref=e74]: "Alice:"
          - generic [ref=e75]: Hello world from test suite!
        - generic [ref=e76]: TestUser entered Metalyceum!
      - generic [ref=e77]:
        - textbox "Message everyone in Metalyceum..." [ref=e78]
        - button "Send" [ref=e79] [cursor=pointer]
    - generic [ref=e80]:
      - button "✕" [ref=e81] [cursor=pointer]
      - generic [ref=e82]:
        - heading "Room" [level=2] [ref=e83]
        - text: 1 / 10 Players
      - generic [ref=e85]: Idle
      - button "📺 Open Theater Mode" [ref=e89] [cursor=pointer]:
        - generic [ref=e90]: 📺 Open Theater Mode
      - generic [ref=e91]:
        - heading "Players in Room" [level=3] [ref=e92]
        - list [ref=e93]
      - button "Edit Room Event" [ref=e95] [cursor=pointer]
  - generic [ref=e96]:
    - generic [ref=e97]:
      - generic [ref=e98]: W
      - generic [ref=e99]: A
      - generic [ref=e100]: S
      - generic [ref=e101]: D
      - generic [ref=e102]: Move
    - generic [ref=e103]:
      - generic [ref=e104]: Space
      - generic [ref=e105]: Jump
    - generic [ref=e106]:
      - generic [ref=e107]: ▲
      - generic [ref=e108]: ▼
      - generic [ref=e109]: ◀
      - generic [ref=e110]: ▶
      - generic [ref=e111]: Orbit Camera
    - generic [ref=e112]:
      - generic [ref=e113]: Drag Mouse
      - generic [ref=e114]: Rotate Camera
    - generic [ref=e115]:
      - generic [ref=e116]: Scroll
      - generic [ref=e117]: Zoom
    - generic [ref=e118]:
      - generic [ref=e119]: "`"
      - generic [ref=e120]: Toggle Debug
    - generic [ref=e121]:
      - generic [ref=e122]: M
      - generic [ref=e123]: Toggle Map
  - generic [ref=e124]:
    - generic [ref=e125]:
      - generic [ref=e126]:
        - heading "System Diagnostics" [level=3] [ref=e127]
        - paragraph [ref=e128]: Real-time player, camera, and engine metrics
      - button "Copy Info" [ref=e129] [cursor=pointer]
    - separator [ref=e130]
    - generic [ref=e131]:
      - generic [ref=e132]:
        - generic [ref=e133]: Player Position
        - generic [ref=e134]: "X: 0.00 | Y: 0.00 | Z: 44.00"
      - generic [ref=e135]:
        - generic [ref=e136]: Camera Position
        - generic [ref=e137]: "X: 3.00 | Y: 5.50 | Z: 60.00"
      - generic [ref=e138]:
        - generic [ref=e139]: Camera Direction
        - generic [ref=e140]: "X: -0.18 | Y: -0.24 | Z: -0.95"
    - separator [ref=e141]
    - generic [ref=e143]:
      - generic [ref=e144]:
        - generic [ref=e145]: FPS
        - generic [ref=e146]: "3"
      - generic [ref=e147]:
        - generic [ref=e148]: Players
        - generic [ref=e149]: "2"
      - generic [ref=e150]:
        - generic [ref=e151]: Visible Props
        - generic [ref=e152]: 38 / 85
      - generic [ref=e153]:
        - generic [ref=e154]: Live Rooms
        - generic [ref=e155]: "0"
    - separator [ref=e156]
    - generic [ref=e158]: Console Errors
  - dialog:
    - generic:
      - button: ✕
      - generic:
        - heading [level=2]: Theater Mode
      - generic:
        - paragraph: Press Esc or click outside to close.
        - button: Close
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
  31  |     await debugBtn.click();
  32  | 
  33  |     // Verify debug panel is shown
  34  |     const debugPanel = page.locator("#debug-panel");
  35  |     await expect(debugPanel).toHaveAttribute("aria-hidden", "false");
  36  | 
  37  |     // Verify coordinate displays exist
  38  |     const playerPos = page.locator("#debug-player-pos");
> 39  |     await expect(playerPos).toContainText(/X:/);
      |                             ^ Error: expect(locator).toContainText(expected) failed
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
  132 |     await expect(aliceChatLog).toContainText("Yes Alice, loud and clear!");
  133 | 
  134 |     // Clean up
  135 |     await aliceContext.close();
  136 |     await bobContext.close();
  137 |   });
  138 | });
  139 | 
```