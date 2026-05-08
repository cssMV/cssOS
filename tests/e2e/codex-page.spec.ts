import { test, expect } from "@playwright/test";

test("codex page renders for confucius", async ({ page }) => {
  await page.goto("/codex/confucius");
  await expect(
    page.locator("body").locator("text=/孔子|Confucius/i").first(),
  ).toBeVisible({ timeout: 20_000 });
});
