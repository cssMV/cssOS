// Anonymous-safe — runs without auth (CSSOS_WAVE84)
import { test, expect } from "@playwright/test";

test("#leaderboard shows three columns", async ({ page }) => {
  await page.goto("/#leaderboard");
  const board = page.locator(
    "#leaderboard, .leaderboard, [data-panel='leaderboard']",
  ).first();
  await expect(board).toBeVisible({ timeout: 10_000 });
  const columns = board.locator(".leaderboard-column, [data-leaderboard-column]");
  await expect(columns).toHaveCount(3, { timeout: 10_000 });
});
