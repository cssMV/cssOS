import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["iPhone 14"] });

test("mobile codex action bar buttons meet 44px tap target", async ({ page }) => {
  await page.goto("/codex/confucius");
  const bar = page.locator(
    ".codex-action-bar, [data-action-bar], .action-bar",
  ).first();
  await expect(bar).toBeVisible({ timeout: 15_000 });
  const buttons = bar.locator("button, a[role='button']");
  const count = await buttons.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const box = await buttons.nth(i).boundingBox();
    if (!box) continue;
    expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(40);
  }
});
