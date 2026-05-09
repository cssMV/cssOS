# Wave 107 — iOS Native OAuth Handoff (All Non-Apple Providers)

**Owner**: Jing  
**Drafted**: 2026-05-08 (after Wave 106 — Apple Sign-In Native landed)  
**Goal**: Make Google / GitHub / Facebook / Discord / Twitter / Microsoft / LinkedIn (and every future provider) login work inside the iOS Capacitor app — same one-tap UX as Apple, no bouncing to external Safari with `auth_failed`.

---

## Why this wave exists

Wave 106 shipped native Apple Sign-In via `@capacitor-community/apple-sign-in`. That works because Apple gives us a JWT identity token directly in-process. **Every other provider is still broken on iOS native** because:

1. Frontend correctly opens OAuth in `SFSafariViewController` via `@capacitor/browser` and tags the start URL with `?intent=ios-app`.
2. **Provider strips that query** — only `state` and `code` survive the round-trip.
3. Backend callback (`/api/auth/google/callback` etc.) calls `setAuthSession()` and `res.redirect("/")` — sets the cookie in **Safari's cookie jar**, which is **not** the WKWebView's jar.
4. Universal Link return path (`/auth/return`) exists but no callback uses it.
5. User ends up at `cssstudio.app` in external Safari, signed in there but **not** in the app → app shows `auth_failed`.

We solved Apple by skipping OAuth entirely. For everything else we need a **secure cookie handoff** between the SFSafariViewController session and the WebView session.

---

## Architecture: short-lived handoff token

```
[ iOS App tap "Google" ]
        │
        ▼
iosOpenSystemBrowserModule(url + state w/ intent=ios-app)
        │
        ▼ Browser.open → SFSafariViewController
[ accounts.google.com ] → user logs in
        │
        ▼ provider redirects to:
GET /api/auth/google/callback?code=...&state=<encoded:{intent:"ios-app",csrf:...}>
        │
        ├── decode state → intent="ios-app"
        ├── exchange code for tokens, fetch profile, upsert user
        ├── generate one-shot handoff_token (random 32 bytes b64url)
        ├── persist {token, user_id, provider, created_at, expires_at=+90s, used=false}
        └── 302 → https://cssstudio.app/auth/return?handoff=<token>
        │
        ▼ Universal Link claims it → opens cssOS app
[ Capacitor appUrlOpen listener ]
        │
        ▼ extracts handoff, calls:
POST /api/auth/handoff/exchange { handoff }
        │
        ├── validate (exists, not used, not expired)
        ├── mark used=true
        ├── setAuthSession(req, user_id, provider) ← writes cookie on THIS request
        └── 200 { ok: true, user: {...} }
        │
        ▼
Frontend reloads → /api/me returns user → logged in.
```

**Why this is safe**:
- Handoff token is single-use, 90-second TTL, bound to user_id — even if intercepted, attacker gets one shot at a session for an account they'd already need to know.
- No cookie sharing assumptions; works regardless of iOS ITP cookie isolation rules across versions.
- Same flow on Android (later when we ship Capacitor Android).

---

## Tasks

### Backend (`src/index.ts`)

- [ ] **T1**. Create table `oauth_handoff_tokens`:
  ```sql
  CREATE TABLE IF NOT EXISTS oauth_handoff_tokens (
    token         TEXT PRIMARY KEY,
    user_id       TEXT NOT NULL,
    provider      TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    used_at       TIMESTAMPTZ
  );
  CREATE INDEX ON oauth_handoff_tokens(expires_at);
  ```
  Add migration in `db/migrations/` with same convention as existing migrations.

- [ ] **T2**. Helper `encodeOAuthState({intent, csrf, return_to})` / `decodeOAuthState(state)` — JSON + base64url + HMAC sign with `OAUTH_STATE_SECRET` env. Reject unsigned / mismatched.

- [ ] **T3**. Helper `issueHandoffToken(user_id, provider): Promise<string>` and `redeemHandoffToken(token): Promise<{user_id, provider} | null>` (atomic UPDATE … RETURNING with `used_at IS NULL AND expires_at > now()`).

- [ ] **T4**. Modify each provider's OAuth **start** route to call `encodeOAuthState({ intent: req.query.intent || "web", csrf })` instead of raw CSRF random:
  - `/api/auth/google` (start)
  - `/api/auth/github` (start)
  - `/api/auth/facebook` (start)
  - `/api/auth/discord` (start)
  - `/api/auth/twitter` (start)
  - `/api/auth/microsoft` (start) — if exists
  - `/api/auth/linkedin` (start) — if exists

- [ ] **T5**. Modify each provider's **callback** to:
  ```ts
  const decoded = decodeOAuthState(req.query.state);
  if (!decoded) return res.redirect("/?auth=state_invalid");
  // ... exchange code, upsert user, get user_id ...
  if (decoded.intent === "ios-app") {
    const tok = await issueHandoffToken(user_id, "google");
    return res.redirect(`/auth/return?handoff=${tok}`);
  }
  setAuthSession(req, user_id, "google");
  return res.redirect(decoded.return_to || "/");
  ```
  Same change in: google, github, facebook, discord, twitter, microsoft, linkedin callbacks.

- [ ] **T6**. New endpoint `POST /api/auth/handoff/exchange`:
  ```ts
  app.post("/api/auth/handoff/exchange", express.json(), async (req, res) => {
    const { handoff } = req.body || {};
    if (!handoff || typeof handoff !== "string") return res.status(400).json({ ok:false, error:"missing_handoff" });
    const result = await redeemHandoffToken(handoff);
    if (!result) return res.status(401).json({ ok:false, error:"invalid_or_expired" });
    setAuthSession(req, result.user_id, result.provider);
    const user = await getUserById(result.user_id);
    return res.json({ ok:true, user });
  });
  ```

- [ ] **T7**. Cron / startup task: nightly delete `oauth_handoff_tokens WHERE expires_at < now() - interval '1 day'` (keep 1 day for forensics).

### Frontend

- [ ] **T8**. `public/app.boot.js` (or new `app.ios-capacitor.js`): on `Capacitor.Plugins.App.addListener('appUrlOpen', ...)`, parse the URL; if path is `/auth/return` and there's a `handoff` query, POST it to `/api/auth/handoff/exchange`, then `location.reload()` on success or show a toast with the specific error.

- [ ] **T9**. `public/app.login-panel.js`: `iosOpenSystemBrowserModule` already tags `intent=ios-app` in the URL — verify the tag survives via state encoding (it should, since T2 reads `req.query.intent`).

- [ ] **T10**. Cache-bust `?v=` on any modified `public/*.js` files in `public/index.html`.

### Capacitor / iOS native

- [ ] **T11**. Confirm Xcode **Signing & Capabilities** has **Associated Domains**:
  ```
  applinks:cssstudio.app
  webcredentials:cssstudio.app
  ```
  (Already added; just verify before testing.)

- [ ] **T12**. AASA file at `public/.well-known/apple-app-site-association` already lists `/auth/return*` — verify with:
  ```bash
  curl -sI https://cssstudio.app/.well-known/apple-app-site-association
  curl -s https://app-site-association.cdn-apple.com/a/v1/cssstudio.app
  ```

### Testing

- [ ] **T13**. Add Playwright e2e for the **web** path of each provider (mock the OAuth dance) — verifies T4/T5 didn't break web sign-in.
- [ ] **T14**. Manual test on iPhone: sign in with Google, GitHub, Facebook, Discord, Twitter — confirm one-tap return into the app, no `auth_failed`.
- [ ] **T15**. Manual test "kill app mid-flow" — open Google in SFSafariViewController, force-quit cssOS, complete sign-in. Universal Link should re-launch app and complete handoff. Expected: works (Capacitor's `appUrlOpen` fires on cold start too).
- [ ] **T16**. Manual test "handoff replay attack" — copy a `?handoff=xxx` URL, paste twice. Second exchange must fail with `invalid_or_expired`.

---

## Estimated effort

| Block | Hours |
|---|---|
| Backend (T1–T7) | 3–4h — most time is methodically updating ~6 callbacks symmetrically |
| Frontend (T8–T10) | 1h |
| Capacitor verify (T11–T12) | 15min |
| Testing (T13–T16) | 1.5h |
| **Total** | **~6 hours** focused work |

---

## Out of scope (future waves)

- **Wave 108**: Android Capacitor parity — same handoff flow works, but Android uses App Links (verified via `assetlinks.json`) instead of Universal Links. Same backend, different native plumbing.
- **Wave 109**: WeChat / QQ / Weibo on iOS — these need provider SDKs, not standard OAuth. Will revisit when CN distribution timing is right.
- **Wave 110**: Bluesky on iOS — already uses a different modal flow (`openBlueskyLoginModalModule`), needs separate audit but not blocking.

---

## Files likely to change

```
src/index.ts                           (~150 lines: T1–T7)
db/migrations/NNNN_oauth_handoff.sql   (new)
public/app.login-panel.js              (small: T9 verify)
public/app.boot.js (or new .js)        (T8 — appUrlOpen listener)
public/index.html                      (T10 — cache-bust)
docs/WAVE_107_IOS_NATIVE_OAUTH_HANDOFF.md  (this doc)
```

---

## Risk register

1. **State signing secret rotation** — if `OAUTH_STATE_SECRET` rotates mid-flow, in-flight users see `state_invalid`. Mitigate: accept both old + new secret for 1h after rotation.
2. **Handoff token DB load** — at scale, GC matters. T7 cron handles it; if PG is busy, switch to Redis with TTL.
3. **Universal Link not claiming on first install** — iOS sometimes takes a minute. Fallback: web view in external Safari shows "Open in cssOS" button that uses `cssos://auth/return?...` custom scheme as last resort. Not needed v1.
4. **Provider redirect_uri whitelist** — if any provider's developer console has `https://cssstudio.app/api/auth/<x>/callback` whitelisted but not `/auth/return`, that's fine — we redirect _from_ the callback _to_ `/auth/return`. No provider config changes needed.

---

## Definition of done

- [ ] On a fresh iPhone install, tapping Google / GitHub / Facebook / Discord / Twitter inside the cssOS app:
  - Opens SFSafariViewController
  - Returns to the app within 2 seconds of the user completing provider auth
  - Lands the user on `/` already signed in (no extra tap, no `auth_failed`)
- [ ] Web flow on `cssstudio.app` (desktop + mobile Safari) unchanged — every provider still works.
- [ ] Replay of an old `handoff` token returns 401, no session created.
- [ ] One e2e test per provider in CI, green.

---

晚安兄弟。明天见。🌙
