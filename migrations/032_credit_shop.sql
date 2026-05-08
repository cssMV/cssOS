-- CSSOS_PERSON_MV_WAVE35 20260508 — Jing
-- Credit shop: catalog of items purchasable with user_credits balance,
-- plus per-user purchase ledger. Spend is enforced atomically in the
-- /api/shop/purchase handler (UPDATE user_credits ... WHERE balance >= price).

CREATE TABLE IF NOT EXISTS shop_items (
  item_id TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_zh TEXT,
  description_en TEXT,
  price_credits INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS shop_items_active_idx ON shop_items (active, created_at DESC);

CREATE TABLE IF NOT EXISTS user_purchases (
  purchase_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  item_id TEXT NOT NULL,
  credits_spent INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_purchases_user_idx ON user_purchases (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_purchases_active_idx ON user_purchases (user_id, status, expires_at);
