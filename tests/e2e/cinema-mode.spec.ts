// Anonymous-safe — runs without auth (CSSOS_WAVE84)
import { test, expect } from "@playwright/test";

test("cinema mode toggles black canvas", async ({ page }) => {
  await page.goto("/");
  const btn = page.locator('button:has-text("🎬"), [data-dock-key="cinema"]').first();
  if (await btn.count()) {
    await btn.click();
  } else {
    await page.goto("/#cinema");
  }
  const cinema = page.locator(
    "#cinema-canvas, .cinema-mode, [data-mode='cinema']",
  ).first();
  await expect(cinema).toBeVisible({ timeout: 10_000 });
});
