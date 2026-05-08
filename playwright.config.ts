// CSSOS_WAVE79 20260508 — Jing — Playwright e2e config.
// Targets prod by default; set BASE_URL=http://localhost:3000 for local.
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // serial — shared backend
  timeout: 60_000,
  use: {
    baseURL: process.env.BASE_URL || "https://cssstudio.app",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 14"] } },
  ],
});
