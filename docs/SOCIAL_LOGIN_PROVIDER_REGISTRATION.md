# Social Login Provider Registration — One-Stop Application Guide

**Owner**: Jing
**Last updated**: 2026-05-09

This is the master checklist for registering cssOS with every supported social login provider. For each provider you'll find:

- 🔗 **Apply link** — direct URL to the developer console signup
- 📝 **App type** — what kind of app to create (web / OAuth / OIDC)
- 🎯 **Scopes** — minimum permissions needed
- ↩ **Redirect URI** — exact value to register
- 🔑 **Env vars** — what to set on the server after approval
- ✅ **Backend status** — whether cssOS already has the OAuth handler

> **Universal rule**: the redirect URI is **always** `https://cssstudio.app/api/auth/<provider>/callback`. Some providers also accept multiple URIs — register both prod and a localhost dev variant if the console allows it.

---

## Quick status legend

- 🟢 **Live** — backend handler exists, just register the app and set env vars
- 🟡 **Backend pending** — needs a small backend handler (≤80 lines per provider, follows the existing google/github pattern). I'll build these in Wave 109.
- 🔴 **Special** — non-OAuth flow or platform-specific gotcha

---

## Tier 1 — Live (just register + set env vars)

### 🟢 Apple Sign-In  ✅ Already shipped (Wave 106)

- 🔗 Apply: https://developer.apple.com/account/resources/identifiers/list
- 📝 App type: **Service ID** under your existing Apple Developer team (Team ID `QBG9PRVBYZ`)
- 🎯 Scopes: `email`, `name`
- ↩ Redirect URI: `https://cssstudio.app/auth/apple/callback`
- 🔑 Env: `APPLE_CLIENT_ID`, `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY` (.p8), `APPLE_NATIVE_CLIENT_ID=app.cssstudio.app`
- ✅ Status: working in production + iOS native

### 🟢 Google

- 🔗 Apply: https://console.cloud.google.com/apis/credentials → "Create Credentials" → "OAuth client ID"
- 📝 App type: **Web application**
- 🎯 Scopes: `openid email profile` (default OIDC). Optional: YouTube `https://www.googleapis.com/auth/youtube.readonly` for connected uploads.
- ↩ Redirect URIs (register **both**):
  - `https://cssstudio.app/api/auth/google/callback`
  - `https://cssstudio.app/auth/google/callback`
- 🔑 Env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- ✅ Status: live (you logged in with this in Wave 107)

### 🟢 GitHub

- 🔗 Apply: https://github.com/settings/developers → "New OAuth App"
- 📝 App type: **OAuth App** (not GitHub App)
- 🎯 Scopes: `read:user user:email` (cssOS asks for these in the start route)
- ↩ Redirect URI: `https://cssstudio.app/api/auth/github/callback`
- 🔑 Env: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- ✅ Status: live

### 🟢 Facebook

- 🔗 Apply: https://developers.facebook.com/apps/ → "Create App" → "Consumer"
- 📝 App type: **Consumer**, then add product **Facebook Login → Web**
- 🎯 Scopes: `email public_profile`
- ↩ Valid OAuth Redirect URI: `https://cssstudio.app/api/auth/facebook/callback`
- 🔑 Env: `FACEBOOK_CLIENT_ID` (= App ID), `FACEBOOK_CLIENT_SECRET` (= App Secret)
- ⚠️ Facebook requires app review for `email`. Submit basic app review with screenshots. Until approved, only test users (added in Roles → Testers) can sign in.
- ✅ Status: live (subject to FB review)

### 🟢 X (Twitter)

- 🔗 Apply: https://developer.x.com/en/portal/dashboard → "Create Project" → enable User Authentication Settings → OAuth 2.0
- 📝 App type: **Web App, Automated App, or Bot** with OAuth 2.0 Type **Confidential**
- 🎯 Scopes: `users.read tweet.read offline.access`
- ↩ Callback URI: `https://cssstudio.app/api/auth/x/callback`
- ↩ Website URL: `https://cssstudio.app`
- 🔑 Env: `X_CLIENT_ID`, `X_CLIENT_SECRET`
- ⚠️ Free tier rate-limited; Basic plan ($200/mo) lifts most quotas if you grow.
- ✅ Status: live

### 🟢 WeChat (微信开放平台)

- 🔗 Apply: https://open.weixin.qq.com/cgi-bin/frame?t=home/web_tmpl → "网站应用"
- 📝 App type: **网站应用** (not 公众号)
- 🎯 Scope: `snsapi_login`
- ↩ Authorized callback domain: `cssstudio.app` (then full URI is `https://cssstudio.app/api/auth/wechat/callback`)
- 🔑 Env: `WECHAT_CLIENT_ID` (AppID), `WECHAT_CLIENT_SECRET` (AppSecret)
- ⚠️ 需要营业执照 + 企业账号 + 300 RMB 认证费 + 7 天审核。
- ✅ Status: live

### 🟢 Bluesky

- 🔗 No traditional console — Bluesky uses public OAuth. Register a client metadata JSON at any URL on cssstudio.app.
- 📝 App type: confidential client; metadata should be served at `https://cssstudio.app/.well-known/bluesky-client-metadata.json`
- 🎯 Scope: `atproto transition:generic`
- ↩ Redirect URI: `https://cssstudio.app/auth/bsky/callback`
- 🔑 Env: `BSKY_CLIENT_ID` (= the metadata URL), `BSKY_CLIENT_SECRET` (signing key)
- ✅ Status: live (also has app-password fallback modal)

---

## Tier 2 — Backend handler pending (Wave 109)

These are listed in the login panel as "Unavailable" because there's no backend handler yet. I'll add them in a follow-up wave following the same google/github pattern (~80 lines each). Register the dev apps now so we can flip them on as soon as the handlers ship.

### 🟡 Discord

- 🔗 Apply: https://discord.com/developers/applications → "New Application" → OAuth2 tab
- 📝 App type: any (general application)
- 🎯 Scopes: `identify email`
- ↩ Redirects (under OAuth2 → Redirects): `https://cssstudio.app/api/auth/discord/callback`
- 🔑 Env: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`

### 🟡 Reddit

- 🔗 Apply: https://www.reddit.com/prefs/apps → "create another app..." → **web app**
- 📝 App type: **web app**
- 🎯 Scopes: `identity`
- ↩ Redirect URI: `https://cssstudio.app/api/auth/reddit/callback`
- 🔑 Env: `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`
- ⚠️ Reddit requires a User-Agent header on every API call — handler will set `cssOS/1.0 (by /u/<your_handle>)`.

### 🟡 Slack

- 🔗 Apply: https://api.slack.com/apps → "Create New App" → "From scratch"
- 📝 App type: choose any workspace for development
- 🎯 OAuth scopes (User Token Scopes): `openid email profile`
- ↩ Redirect URLs (OAuth & Permissions): `https://cssstudio.app/api/auth/slack/callback`
- 🔑 Env: `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`
- ⚠️ For Sign-in-with-Slack across workspaces, enable **Distribution → Public Distribution**.

### 🟡 Twitch

- 🔗 Apply: https://dev.twitch.tv/console/apps → "Register Your Application"
- 📝 App type: **Website Integration**
- 🎯 Scopes: `user:read:email`
- ↩ OAuth Redirect URLs: `https://cssstudio.app/api/auth/twitch/callback`
- 🔑 Env: `TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`

### 🟡 LinkedIn

- 🔗 Apply: https://www.linkedin.com/developers/apps → "Create app"
- 📝 App type: requires a LinkedIn Page (create one for "CSS Studio"). Then add product **Sign In with LinkedIn using OpenID Connect**.
- 🎯 Scopes: `openid profile email`
- ↩ Authorized redirect URL: `https://cssstudio.app/api/auth/linkedin/callback`
- 🔑 Env: `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`

### 🟡 GitLab

- 🔗 Apply: https://gitlab.com/-/user_settings/applications → "Add new application"
- 📝 App type: **Confidential** = yes
- 🎯 Scopes: `read_user openid email profile`
- ↩ Redirect URI: `https://cssstudio.app/api/auth/gitlab/callback`
- 🔑 Env: `GITLAB_CLIENT_ID`, `GITLAB_CLIENT_SECRET`

### 🟡 Microsoft (Azure AD / Personal Microsoft Accounts)

- 🔗 Apply: https://portal.azure.com → Azure Active Directory → App registrations → "New registration"
- 📝 Account types: **"Personal Microsoft accounts only"** (or multi-tenant if you want Office365 users)
- 🎯 Scopes: `openid profile email User.Read`
- ↩ Redirect URI (Web platform): `https://cssstudio.app/api/auth/microsoft/callback`
- 🔑 Env: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT=common`

### 🟡 Spotify

- 🔗 Apply: https://developer.spotify.com/dashboard → "Create app"
- 📝 App type: any
- 🎯 Scopes: `user-read-email user-read-private`
- ↩ Redirect URIs: `https://cssstudio.app/api/auth/spotify/callback`
- 🔑 Env: `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`

### 🟡 Pinterest

- 🔗 Apply: https://developers.pinterest.com/apps/ → "Create App" (need a business account)
- 📝 App type: standard, for OAuth
- 🎯 Scopes: `user_accounts:read`
- ↩ Redirect URI: `https://cssstudio.app/api/auth/pinterest/callback`
- 🔑 Env: `PINTEREST_CLIENT_ID`, `PINTEREST_CLIENT_SECRET`
- ⚠️ Approval required to leave "Trial" mode.

### 🟡 Dribbble

- 🔗 Apply: https://dribbble.com/account/applications/new
- 📝 App type: standard application
- 🎯 Scopes: `public`
- ↩ Callback URL: `https://cssstudio.app/api/auth/dribbble/callback`
- 🔑 Env: `DRIBBBLE_CLIENT_ID`, `DRIBBBLE_CLIENT_SECRET`

### 🟡 Behance

- 🔗 Apply: https://www.behance.net/dev/register/apps
- 📝 App type: standard
- 🎯 Scopes: `activity_read`
- ↩ Redirect URI: `https://cssstudio.app/api/auth/behance/callback`
- 🔑 Env: `BEHANCE_CLIENT_ID`, `BEHANCE_CLIENT_SECRET`
- ⚠️ Adobe acquired Behance and the dev portal has been flaky. May require Adobe ID.

### 🟡 Medium

- 🔗 Apply: https://medium.com/me/applications
- 📝 App type: standard
- 🎯 Scopes: `basicProfile`
- ↩ Callback URL: `https://cssstudio.app/api/auth/medium/callback`
- 🔑 Env: `MEDIUM_CLIENT_ID`, `MEDIUM_CLIENT_SECRET`
- ⚠️ Medium has been deprecating their public API. Confirm at registration time that integration tokens still work; if not, remove this provider from the panel.

### 🟡 Stack Overflow / Stack Exchange

- 🔗 Apply: https://stackapps.com/apps/oauth/register
- 📝 App type: any
- 🎯 Scopes: leave default (basic profile)
- ↩ OAuth Domain: `cssstudio.app` (callback path is implicit)
- 🔑 Env: `STACKAPPS_CLIENT_ID`, `STACKAPPS_CLIENT_SECRET`, `STACKAPPS_KEY` (rate-limit key)

### 🟡 KakaoTalk

- 🔗 Apply: https://developers.kakao.com/console/app → "添加应用"
- 📝 App type: standard
- 🎯 Scopes: `account_email profile_nickname`
- ↩ Redirect URI: `https://cssstudio.app/api/auth/kakao/callback`
- 🔑 Env: `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`
- 🌏 Required for serious KR market presence.

### 🟡 LINE

- 🔗 Apply: https://developers.line.biz/console/ → "Create new channel" → **LINE Login**
- 📝 App type: **LINE Login**
- 🎯 Scopes: `openid email profile`
- ↩ Callback URL: `https://cssstudio.app/api/auth/line/callback`
- 🔑 Env: `LINE_CLIENT_ID` (= Channel ID), `LINE_CLIENT_SECRET` (= Channel secret)
- 🌏 Required for JP/TW/TH market.

### 🟡 Telegram

- 🔗 Apply: https://core.telegram.org/widgets/login (no developer portal — register a bot via [@BotFather](https://t.me/BotFather) first, then claim a domain)
- 📝 App type: **Telegram Login Widget** (different from OAuth — it's a signed payload)
- 🎯 Scopes: n/a — fixed payload (id, first_name, last_name, username, photo_url)
- ↩ Domain registered with [@BotFather](https://t.me/BotFather): `cssstudio.app`
- 🔑 Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`
- 🔴 Note: Telegram is **not** standard OAuth — uses an HMAC-signed redirect. Backend handler will be a different shape.

---

## Tier 3 — Special / non-OAuth (defer or descope)

### 🔴 WhatsApp

- WhatsApp is an end-user messaging platform, **not** an OAuth provider. There's no "Sign in with WhatsApp" — the closest thing is **WhatsApp Business API** for messaging customers. Recommend **removing the WhatsApp tile** from the login panel; it'll never become available.

### 🔴 TikTok

- 🔗 Apply: https://developers.tiktok.com/apps → "Connect a new app" → **Login Kit**
- 📝 Scopes: `user.info.basic`
- ↩ Redirect URI: `https://cssstudio.app/api/auth/tiktok/callback`
- 🔑 Env: `TIKTOK_CLIENT_ID`, `TIKTOK_CLIENT_SECRET`
- ⚠️ TikTok approval is **slow** (3–6 weeks) and they have strict use-case justification requirements. Worth applying early if KR/TW/SE Asia matter.

### 🔴 Instagram

- 🔗 Apply: through Facebook Developer Console → add product **Instagram Basic Display** (Instagram Login is being deprecated in favor of "Login with Facebook for Instagram users")
- ⚠️ **Strongly recommend descope** — Instagram Basic Display is being shut down 2024-12. Use Facebook Login; users with linked IG accounts auto-link.

### 🔴 Weibo

- 🔗 Apply: https://open.weibo.com/connect → "网站接入"
- 🎯 Scopes: `email`
- ↩ Redirect URI: `https://cssstudio.app/api/auth/weibo/callback`
- 🔑 Env: `WEIBO_CLIENT_ID` (App Key), `WEIBO_CLIENT_SECRET` (App Secret)
- ⚠️ Requires CN ICP filing of cssstudio.app domain. Defer until ICP is in place.

---

## After registration: how to plug in env vars

Once you have `<PROVIDER>_CLIENT_ID` + `<PROVIDER>_CLIENT_SECRET` in hand:

1. SSH to the cssOS server.
2. Add to `/etc/cssos/env` (or wherever `dotenv` reads from):
   ```bash
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   ```
3. Restart the cssOS service.
4. The login panel auto-detects via `/api/auth/providers` (the start route returns 503 `<provider>_not_configured` if either env is missing → panel marks it Unavailable; both present → enabled).

> The panel does **not** need a code change to enable a Tier-1 provider — set the env, restart, done. Tier-2 needs the backend handler first.

---

## Wave 109 (proposed): backend handlers for Tier 2

For each Tier-2 provider, mirror the existing google/github start+callback pattern. ~80 lines per provider, all six can land together. This unlocks: Discord, Reddit, Slack, Twitch, LinkedIn, GitLab, Microsoft, Spotify, Pinterest, Dribbble, Behance, Medium, StackApps, Kakao, LINE.

Telegram needs a custom verifier (HMAC-signed widget payload, not OAuth) — separate small task.

---

## DoD for "every provider works"

- [ ] All Tier-1 providers green in `/api/auth/providers` health endpoint
- [ ] All Tier-2 backend handlers shipped (Wave 109)
- [ ] All Tier-2 providers green in `/api/auth/providers` after env wiring
- [ ] Login panel shows all enabled providers as clickable on web + iOS native
- [ ] iOS native handoff verified for at least one Tier-2 provider (Discord recommended — fast approval)
- [ ] Tier-3 providers either descoped or marked "coming soon"
