// CSSOS_WAVE84 20260508 — Auth-gated smoke: signed-in user sees dock + avatar.
// Requires E2E_TEST_USER (E2E_TEST_EMAIL + E2E_TEST_PASSWORD).
import { test, expect } from "@playwright/test";

test.skip(
  !!process.env.CI && !process.env.E2E_TEST_PASSWORD,
  "skipping auth tests — E2E_TEST_PASSWORD not set in this CI run",
);

test("signed-in dock renders avatar / account chip", async ({ page }) => {
  await page.goto("/");
  // After login the avatar/account chip should be present.
  const accountChip = page
    .locator('[data-account-chip], .account-chip, [data-user-avatar]')
    .first();
  await expect(accountChip).toBeVisible({ timeout: 15_000 });
});
