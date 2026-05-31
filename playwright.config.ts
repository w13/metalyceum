import { defineConfig } from "@playwright/test";

const baseURL = "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  timeout: 60_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev -- --ip 127.0.0.1 --port 8787 --show-interactive-dev-session=false",
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: true,
  },
});
