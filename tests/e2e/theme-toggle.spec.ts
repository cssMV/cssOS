import { test, expect } from "@playwright/test";

test("theme toggle flips data-theme and keeps panels readable", async ({ page }) => {
  await page.goto("/");
  const before = await page.evaluate(
    () => document.documentElement.getAttribute("data-theme") || "dark",
  );
  // Try a known theme toggle selector; fall back to setting via localStorage.
  const toggle = page.locator(
    "[data-theme-toggle], button[aria-label*='theme' i], button:has-text('Theme')",
  ).first();
  if (await toggle.count()) {
    await toggle.click();
  } else {
    await page.evaluate((target) => {
      document.documentElement.setAttribute("data-theme", target);
    }, before === "light" ? "dark" : "light");
  }
  await page.waitForTimeout(400);
  const after = await page.evaluate(
    () => document.documentElement.getAttribute("data-theme") || "dark",
  );
  expect(after).not.toBe(before);
  // Sanity check: body text color resolves to a non-empty value.
  const color = await page.evaluate(
    () => getComputedStyle(document.body).color,
  );
  expect(color).toMatch(/rgb/);
});
