import { test, expect } from "@playwright/test";

test("embed page returns video tag and frame-friendly headers", async ({ request, page }) => {
  const code = process.env.EMBED_SAMPLE_SHORTCODE || "sample";
  const resp = await request.get(`/embed/${code}`);
  if (resp.status() === 404) {
    test.skip(true, "no sample embed shortcode configured");
  }
  expect(resp.ok()).toBeTruthy();
  const body = await resp.text();
  expect(body).toMatch(/<video|player/i);
  // CSP frame-ancestors should not block embedding by default.
  const csp = resp.headers()["content-security-policy"] || "";
  expect(csp.includes("frame-ancestors 'none'")).toBeFalsy();
  // Render the page to make sure the <video> element actually attaches.
  await page.goto(`/embed/${code}`);
  await expect(page.locator("video, .player").first()).toBeVisible({ timeout: 10_000 });
});
