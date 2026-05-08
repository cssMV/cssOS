# Payments Setup — Alipay (支付宝) + WeChat Pay (微信支付)

Wave 104 scaffolding. Stripe (Wave 76) continues to handle USD subscriptions; this guide covers the two CN providers wired in alongside it.

## 1. Alipay (支付宝)

### Register a merchant app
1. Sign up as a 商户 at <https://open.alipay.com/>.
2. Create an application of type **网页&移动应用** (Web & Mobile).
3. Enable the **当面付 / 电脑网站支付** (Web Page Payment) product.
4. Generate an **RSA2** keypair via the Alipay 开放平台助手 tool. You upload the application public key to Alipay; Alipay returns the **Alipay public key** which you store as `ALIPAY_PUBLIC_KEY`.
5. Configure your webhook (异步通知) URL: `https://<your-domain>/api/webhooks/alipay`.

### Env vars
```
ALIPAY_APP_ID=2021000000000000
ALIPAY_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
ALIPAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
ALIPAY_GATEWAY_URL=https://openapi.alipay.com/gateway.do   # optional; sandbox uses openapi.alipaydev.com
```

### Webhook signature
Alipay POSTs `application/x-www-form-urlencoded` callbacks signed with **RSA2 (SHA256withRSA)**. The SDK's `checkNotifySign(body)` performs the canonical-form sort + verify against `ALIPAY_PUBLIC_KEY`. Replay safety is enforced by `payment_provider_events.external_event_id UNIQUE` — we use the Alipay `trade_no` as the dedupe key. Server must respond with the literal string `success` to ack.

## 2. WeChat Pay (微信支付)

### Register a merchant
1. Sign up as a 商户 at <https://pay.weixin.qq.com/>. Requires a Chinese business license (营业执照).
2. Bind your AppID — typically a **公众号** (Official Account), **小程序** (Mini Program), or **开放平台账号** (Open Platform / Native app).
3. Download the merchant private key (`apiclient_key.pem`) and certificate serial number from the merchant portal (商户平台 → 账户中心 → API 安全).
4. Set the **APIv3 key** (32 chars) in the merchant portal.
5. Configure your callback URL: `https://<your-domain>/api/webhooks/wechat` (HTTPS required).

### Env vars
```
WECHAT_MCH_ID=1900000000
WECHAT_APP_ID=wx0000000000000000
WECHAT_API_KEY_V3=32-char-aes-gcm-key
WECHAT_CERT_SERIAL=hex-serial-of-merchant-cert
WECHAT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
WECHAT_NOTIFY_URL=https://<your-domain>/api/webhooks/wechat
WECHAT_PLATFORM_CERT_PEM="-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----"
```

`WECHAT_PLATFORM_CERT_PEM` is the WeChat Pay platform certificate (downloaded periodically from `/v3/certificates`) used to verify webhook signatures.

### Webhook signature
APIv3 webhooks include four headers:
- `Wechatpay-Timestamp`
- `Wechatpay-Nonce`
- `Wechatpay-Signature`
- `Wechatpay-Serial`

The signed string is `${timestamp}\n${nonce}\n${rawBody}\n`, verified with **RSA-SHA256** against the platform certificate. The body's `resource` field is **AES-GCM** encrypted with `WECHAT_API_KEY_V3`; we decrypt to extract `trade_state`, `out_trade_no`, `transaction_id`, `amount`. Replay safety: `external_event_id` UNIQUE, keyed on the WeChat event `id` (or `transaction_id` fallback). Ack with HTTP 200 and JSON `{"code":"SUCCESS","message":"OK"}`.

## 3. ICP filing (中国大陆 ICP 备案)

**Both providers require ICP filing** for any domain that serves traffic from inside mainland China:
- The notify_url / return_url domains must be ICP-filed (备案) with your hosting provider (Aliyun, Tencent Cloud, etc.).
- Without ICP, Alipay merchant review will reject your application; WeChat Pay's domain whitelist setup will fail.
- ICP filing typically takes 2–4 weeks and requires a Chinese business entity + RMB-payable bank account.
- For initial scaffolding/testing without a CN-hosted domain, use Alipay's **sandbox** (`openapi.alipaydev.com`) and WeChat's sandbox merchant; the adapters here both honor the gateway env override.

## 4. Pricing

- USD: $9.99/mo (Stripe).
- CNY: ¥69.00/mo (`PREMIUM_PRICE_CNY_FEN = 6900`) — roughly equivalent to USD $9.99 at typical exchange rates.

## 5. Database

Wave 104 migration `migrations/055_alipay_wechat_payments.sql`:
- Adds `users.alipay_subscription_id`, `users.wechat_subscription_id`.
- Creates `payment_provider_events` (replay-safe via `external_event_id UNIQUE`).
- `users.premium_until` remains the source of truth regardless of provider.

## 6. Frontend

`public/app.premium-modal.js` queries `/api/premium/providers` on open and degrades each CN button to a disabled "Coming soon" state when the corresponding env vars are unset on the server.
