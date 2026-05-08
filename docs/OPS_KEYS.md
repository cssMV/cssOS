# cssOS — Production Ops Keys

CSSOS_WAVE81 20260508 — Jing — single source-of-truth for env vars
required by api-vm. All values live in `/etc/cssos.env` (loaded by
the systemd unit). Never commit real values to git.

## Production env vars (`/etc/cssos.env`)

### Sentry — Wave 80 observability
```
SENTRY_DSN=...                # Server-side error tracking
SENTRY_DSN_PUBLIC=...         # Client-side (public DSN, same value)
SENTRY_TRACES_SAMPLE_RATE=0.1 # Optional, default 0.1
```
Get DSN at: https://sentry.io/settings/projects/{slug}/keys/

### Email digest — Wave 78
```
RESEND_API_KEY=re_...         # https://resend.com/api-keys
EMAIL_DIGEST_SECRET=...       # 32+ random bytes for unsubscribe HMAC
EMAIL_FROM=hi@cssstudio.app
```
Falls back to dev-stub log when `RESEND_API_KEY` is unset.

### Web Push (VAPID) — Wave 32 / 50
```
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
VAPID_SUBJECT=mailto:admin@cssstudio.app
```
Generate: `node scripts/generate-vapid-keys.mjs`

### Stripe — Wave 76 premium membership
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PREMIUM_MONTHLY=price_...   # $9.99/mo product id
```
Webhook URL: `https://cssstudio.app/api/stripe/webhook`

### Admin
```
CSSOS_ADMIN_TOKEN=...                    # 32+ hex; X-Admin-Token header for /api/admin/*
ADMIN_EMAILS=jing@example.com,...        # Comma-separated admin email allowlist
```

---

## Quick verify

After editing `/etc/cssos.env`, restart the service then run:

```bash
# Sentry — should show DSN initialized in journalctl, no [sentry] init skipped warning
sudo systemctl restart cssos && sudo journalctl -u cssos -n 50 | grep -i sentry

# Email digest — dev-stub log if unconfigured, real send otherwise
curl -s -X POST https://cssstudio.app/api/internal/email-digest/dryrun \
  -H "X-Admin-Token: $CSSOS_ADMIN_TOKEN"

# VAPID — public key endpoint must return key
curl -s https://cssstudio.app/api/push/vapid-public-key

# Stripe — webhook reachability (expect 400 "missing stripe-signature", not 404)
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://cssstudio.app/api/stripe/webhook

# Admin token — should return 200 not 403
curl -s -o /dev/null -w "%{http_code}\n" \
  -H "X-Admin-Token: $CSSOS_ADMIN_TOKEN" \
  https://cssstudio.app/api/admin/metrics/dau?days=7

# Web Vitals admin endpoint — Wave 80
curl -s -b "cssos.sid=<your-admin-cookie>" \
  https://cssstudio.app/api/admin/metrics/web-vitals | jq

# Server error log — Wave 82
curl -s -b "cssos.sid=<your-admin-cookie>" \
  "https://cssstudio.app/api/admin/errors?limit=10" | jq
```

If any of the above returns 5xx or "code: *_FAILED", check
`/var/log/cssos/*.log` and the new admin error panel at
`https://cssstudio.app/#admin/errors`.
