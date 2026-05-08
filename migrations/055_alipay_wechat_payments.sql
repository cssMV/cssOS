-- CSSOS_PERSON_MV_WAVE104 20260508 — Jing
-- Alipay (支付宝) + WeChat Pay (微信支付) Premium scaffolding.
-- Additive: Stripe wave 76 columns remain unchanged.

ALTER TABLE users ADD COLUMN IF NOT EXISTS alipay_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wechat_subscription_id TEXT;

CREATE TABLE IF NOT EXISTS payment_provider_events (
  id BIGSERIAL PRIMARY KEY,
  provider TEXT NOT NULL,           -- 'stripe' | 'alipay' | 'wechat'
  external_event_id TEXT UNIQUE,    -- replay-safe dedupe key
  event_kind TEXT NOT NULL,         -- 'subscribed' | 'paid' | 'refunded' | 'cancelled'
  user_id UUID,
  amount_cny_cents BIGINT,
  amount_usd_cents BIGINT,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_provider_events_user_idx
  ON payment_provider_events (user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS payment_provider_events_provider_idx
  ON payment_provider_events (provider, occurred_at DESC);
