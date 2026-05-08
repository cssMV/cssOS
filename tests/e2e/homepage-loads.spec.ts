import { test, expect } from "@playwright/test";

test("homepage renders, dock visible, no console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await page.goto("/");
  await expect(page).toHaveTitle(/CSS Studio/i);
  // Dock is rendered as a fixed bar with role-ish attributes; tolerate either id or class.
  const dock = page.locator("#cssos-dock, .cssos-dock, [data-cssos-dock]").first();
  await expect(dock).toBeVisible({ timeout: 15_000 });
  // Tolerate noisy 3rd-party warnings — fail only on hard errors.
  const hard = errors.filter((e) => !/favicon|sentry|web-vitals/i.test(e));
  expect(hard, hard.join("\n")).toEqual([]);
});
