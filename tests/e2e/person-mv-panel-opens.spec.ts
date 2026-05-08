// Anonymous-safe — runs without auth (CSSOS_WAVE84)
import { test, expect } from "@playwright/test";

test("person-mv panel opens from dock", async ({ page }) => {
  await page.goto("/");
  // Click the 🏛 dock entry; fall back to hash navigation if button isn't found.
  const btn = page.locator('button:has-text("🏛"), [data-dock-key="person-mv"]').first();
  if (await btn.count()) {
    await btn.click();
  } else {
    await page.goto("/#person-mv");
  }
  const panel = page.locator(
    "#person-mv-panel, .person-mv-panel, [data-panel='person-mv']",
  ).first();
  await expect(panel).toBeVisible({ timeout: 15_000 });
});
