// CSSOS_WAVE84 20260508 — Jing — Playwright e2e config with auth project.
// Anonymous-safe specs in tests/e2e/*.spec.ts run without storageState.
// Auth-gated specs in tests/e2e/signed_in_tests/*.spec.ts reuse the
// session captured by tests/e2e/setup.ts (writes .auth/user.json).
import { defineConfig, devices } from "@playwright/test";
import * as path from "node:path";

const STORAGE_STATE = path.resolve(__dirname, "tests/e2e/.auth/user.json");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // serial — shared backend
  timeout: 60_000,
  globalSetup: require.resolve("./tests/e2e/setup.ts"),
  use: {
    baseURL: process.env.BASE_URL || process.env.E2E_BASE_URL || "https://cssstudio.app",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /signed_in_tests\//,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      testIgnore: /signed_in_tests\//,
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "desktop-auth",
      testMatch: /signed_in_tests\/.*\.spec\.ts/,
      use: { ...devices["Desktop Chrome"], storageState: STORAGE_STATE },
    },
  ],
});
