// CSSOS_WAVE84 20260508 — Global auth setup for Playwright.
// Logs in once via the cssOS auth endpoint and persists storageState so
// signed_in_tests/* can reuse the session. If credentials are missing
// (anonymous CI run) we write an empty state so dependent projects skip
// gracefully via the per-spec SKIP guard.
import { chromium, type FullConfig } from "@playwright/test";
import * as fs from "node:fs";
import * as path from "node:path";

export default async function globalSetup(config: FullConfig) {
  const authDir = path.resolve(__dirname, ".auth");
  const statePath = path.join(authDir, "user.json");
  fs.mkdirSync(authDir, { recursive: true });

  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  const baseURL = process.env.E2E_BASE_URL || process.env.BASE_URL || "https://cssstudio.app";

  if (!email || !password) {
    // Anonymous mode: write empty storageState. Auth-gated tests will SKIP.
    if (!fs.existsSync(statePath)) {
      fs.writeFileSync(statePath, JSON.stringify({ cookies: [], origins: [] }));
    }
    console.log("[e2e setup] No E2E_TEST_EMAIL/PASSWORD set — anonymous mode");
    return;
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ baseURL });
  const page = await ctx.newPage();

  // Try API login first (cssOS exposes /api/login). Fall back to UI form.
  const resp = await page.request.post("/api/login", {
    data: { email, password },
    failOnStatusCode: false,
  });
  if (!resp.ok()) {
    await page.goto("/login");
    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState("networkidle");
  }

  await ctx.storageState({ path: statePath });
  await browser.close();
  console.log("[e2e setup] Saved storageState to", statePath);
}
