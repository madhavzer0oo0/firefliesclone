import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    timezoneId: "Asia/Kolkata",
    viewport: { width: 1440, height: 1000 },
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI && process.env.PLAYWRIGHT_ISOLATED_DB !== "1",
  },
});
