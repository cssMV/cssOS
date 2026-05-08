import { test, expect } from "@playwright/test";

test("/ opens search, returns results for 孔子", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("/");
  const overlay = page.locator(
    "#search-overlay, .search-overlay, [data-panel='search']",
  ).first();
  await expect(overlay).toBeVisible({ timeout: 8_000 });
  const input = page.locator(
    "input[type='search'], input[placeholder*='搜索'], input[placeholder*='Search']",
  ).first();
  await input.fill("孔子");
  await page.waitForTimeout(1500);
  const results = page.locator(
    ".search-result, [data-search-result], .search-results > *",
  );
  await expect(results.first()).toBeVisible({ timeout: 10_000 });
});
