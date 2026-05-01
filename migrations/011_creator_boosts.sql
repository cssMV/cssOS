ALTER TABLE billing_accounts
  ALTER COLUMN membership_tier SET DEFAULT 'free';

UPDATE billing_accounts
SET membership_tier = CASE
  WHEN membership_tier IN ('guest', 'free', 'starter', 'pro', 'studio', 'enterprise', 'vip', 'admin') THEN membership_tier
  WHEN membership_tier = 'basic' THEN 'free'
  ELSE 'free'
END;

CREATE TABLE IF NOT EXISTS account_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entitlement_key TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  consumed_quantity INTEGER NOT NULL DEFAULT 0,
  source TEXT NOT NULL DEFAULT 'system',
  source_order_id UUID NULL,
  created_by_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_entitlements_user_idx
  ON account_entitlements(user_id, entitlement_key, created_at DESC);

CREATE TABLE IF NOT EXISTS creator_boost_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boost_kind TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_amount_cents BIGINT NOT NULL DEFAULT 0,
  gross_amount_cents BIGINT NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  status TEXT NOT NULL DEFAULT 'pending',
  stripe_checkout_session_id TEXT NULL,
  stripe_payment_intent_id TEXT NULL,
  stripe_charge_id TEXT NULL,
  paid_at TIMESTAMPTZ NULL,
  canceled_at TIMESTAMPTZ NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_boost_orders_user_idx
  ON creator_boost_orders(user_id, status, created_at DESC);
