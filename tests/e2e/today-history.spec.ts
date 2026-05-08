import { test, expect } from "@playwright/test";

test("today-in-history shelf cards are clickable when present", async ({ page }) => {
  await page.goto("/");
  const shelf = page.locator(
    ".today-shelf, [data-shelf='today'], #today-history-shelf",
  ).first();
  if (!(await shelf.count())) {
    test.skip(true, "today shelf not present today — skipping");
  }
  await expect(shelf).toBeVisible({ timeout: 10_000 });
  const card = shelf.locator(".shelf-card, [data-card]").first();
  if (await card.count()) {
    await expect(card).toBeVisible();
    await card.click();
  }
});
