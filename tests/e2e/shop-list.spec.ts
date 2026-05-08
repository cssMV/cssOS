// Anonymous-safe — runs without auth (CSSOS_WAVE84)
import { test, expect } from "@playwright/test";

test("#shop renders six items", async ({ page }) => {
  await page.goto("/#shop");
  const items = page.locator(".shop-item, [data-shop-item]");
  await expect(items.first()).toBeVisible({ timeout: 10_000 });
  expect(await items.count()).toBeGreaterThanOrEqual(6);
});
