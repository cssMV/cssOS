# Payments Setup — NihaoPay (Alipay + WeChat Pay aggregator)

**Wave 104b** supersedes the direct Alipay/WeChat Pay scaffolds from
wave 104. We now route both vendors through **NihaoPay**
(<https://nihaopay.com>), a payment aggregator that covers Alipay,
WeChat Pay, and UnionPay through a single merchant account.

Stripe (wave 76) continues to handle USD card subscriptions for the
non-CN audience. NihaoPay handles the CN audience.

## Why NihaoPay (vs. direct Alipay + WeChat)

- **One merchant**, one onboarding, one signed contract.
- **No ICP filing required** — NihaoPay is the merchant of record on
  the CN side and handles cross-border compliance.
- **One webhook**, one signature scheme — HMAC-SHA256, no RSA key
  management.
- **USD pricing** — we charge in USD; NihaoPay shows the user the
  CNY-converted amount on the hosted checkout page.

The direct `src/payments/alipay.ts` and `src/payments/wechat.ts`
adapters from wave 104 are kept in-tree but marked
`CSSOS_DEPRECATED` and are no longer reachable from the frontend.

## 1. NihaoPay merchant onboarding

1. Sign up at <https://nihaopay.com/>.
2. Submit business documents — NihaoPay handles CN entity setup.
3. After approval you receive:
   - `merchant_id` (e.g. `MBET102230`)
   - `api_key` — 32-byte hex secret used for **both** Bearer auth and
     HMAC-SHA256 webhook signature verification.
4. Choose vendors to enable: **Alipay**, **WeChat Pay**,
   optionally UnionPay.
5. Configure your IPN (webhook) URL: `https://cssstudio.app/api/webhooks/nihaopay`.
6. Configure your callback URL (browser return): `https://cssstudio.app/premium/return?provider=nihaopay`.

## 2. Env vars

Add these to `/etc/cssos.env` (already provisioned in prod):

```
NIHAOPAY_MERCHANT_ID=MBET102230
NIHAOPAY_API_KEY=cc4ee13...                # 32-byte hex secret
NIHAOPAY_ENV=sandbox                       # or "live"
NIHAOPAY_PURCHASE_PLATFORM_BPS=1000        # platform fee, basis points (10%)
```

## 3. API endpoints used

- **Sandbox:** `https://sandbox.nihaopay.com/api/v1.2/transactions/secure-pay`
- **Live:**    `https://api.nihaopay.com/api/v1.2/transactions/secure-pay`

Auth: HTTP `Authorization: Bearer ${NIHAOPAY_API_KEY}`.

Form-encoded POST body:

```
merchant_id=MBET102230
vendor=alipay         (or "wechatpay" / "unionpay")
currency=USD
amount=999            (cents — $9.99 = 999)
reference=cssos_premium_<userId>_<ts>
ipn_url=https://cssstudio.app/api/webhooks/nihaopay
callback_url=https://cssstudio.app/premium/return?provider=nihaopay
note=CSS Studio Premium Monthly Subscription
```

Response is either an HTML auto-submit form (rendered into a popup tab)
or JSON `{ url: "..." }` (browser is redirected). The user completes
payment on NihaoPay's hosted checkout.

## 4. Webhook (IPN) — `POST /api/webhooks/nihaopay`

Body is `application/x-www-form-urlencoded`. Fields used:
`transaction_id`, `reference`, `status`, `vendor`, `amount`,
`currency`, `signature`.

**Signature verification:**

```
canonical = sorted(keys, alphabetical, excluding "signature")
            joined as "k1=v1&k2=v2&..."
expected  = HMAC_SHA256_HEX(canonical, NIHAOPAY_API_KEY)
verify    = timingSafeEqual(expected, body.signature)
```

On `status=success` (or `paid`):
- parse `reference` → extract user_id prefix
- `users.premium_until = greatest(now(), premium_until) + interval '30 days'`
- insert `payment_provider_events (provider='nihaopay', external_event_id=transaction_id)` — the UNIQUE constraint makes the handler idempotent.

Reply with HTTP 200 and the literal body `OK` to acknowledge.

## 5. Frontend wiring

The Premium dialog (`public/app.premium-modal.js`) shows two NihaoPay
buttons:

- 支付宝 / Alipay (¥69/mo via NihaoPay)
- 微信支付 / WeChat (¥69/mo via NihaoPay)

Both call `POST /api/premium/subscribe?provider=nihaopay&vendor=alipay|wechatpay`,
follow the returned `redirect_url`, and rely on the IPN to credit
premium. No QR rendering needed — NihaoPay's hosted page handles the
WeChat scan flow.

## 6. Notes

- Currency: USD recommended for cross-border — NihaoPay handles CNY
  conversion on the user side at the official rate.
- ICP filing not needed (NihaoPay is the merchant of record on the
  CN side).
- All `payment_provider_events` rows for nihaopay use
  `provider='nihaopay'`; the schema is unchanged from wave 104 (no
  migration required).
