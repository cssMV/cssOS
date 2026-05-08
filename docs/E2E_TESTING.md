# E2E Testing (Playwright)

## Layout

- `tests/e2e/*.spec.ts` — **Anonymous-safe** specs. Run without auth, target the public site (`https://cssstudio.app` by default).
- `tests/e2e/signed_in_tests/*.spec.ts` — **Auth-gated** specs. Reuse a logged-in session captured by `tests/e2e/setup.ts` into `tests/e2e/.auth/user.json`.

## Local run

```bash
# Anonymous suite against prod
npx playwright test

# Against localhost
BASE_URL=http://localhost:3000 npx playwright test

# Auth suite — set creds first
export E2E_TEST_EMAIL=you@example.com
export E2E_TEST_PASSWORD=...
npx playwright test --project=desktop-auth
```

`globalSetup` (in `playwright.config.ts`) runs `tests/e2e/setup.ts` once. It POSTs to `/api/login` (falls back to the `/login` form), saves `storageState`, and the `desktop-auth` project loads it.

## CI (GitHub Actions, `.github/workflows/e2e.yml`)

Triggers: push to main, nightly cron (02:00 UTC), manual.

Required secrets:

| Secret | Purpose |
|---|---|
| `E2E_BASE_URL` | Override target (default `https://cssstudio.app`) |
| `E2E_TEST_EMAIL` | Test account email for auth specs |
| `E2E_TEST_PASSWORD` | Test account password |
| `E2E_ADMIN_TOKEN` | Optional admin bearer for admin-only checks |

If `E2E_TEST_PASSWORD` is unset in CI, auth specs `test.skip(...)` themselves with a clear message — anonymous specs still run and gate the build.

## Adding a new spec

1. Anonymous-safe? Drop into `tests/e2e/`. Prepend `// Anonymous-safe — ...` comment.
2. Needs a logged-in user? Drop into `tests/e2e/signed_in_tests/`. Add the SKIP guard:
   ```ts
   test.skip(!!process.env.CI && !process.env.E2E_TEST_PASSWORD, "no creds");
   ```

Failure artifacts (traces, screenshots) upload as the `playwright-trace` workflow artifact for 7 days.
