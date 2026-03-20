CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  email TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS stripe_connected_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_account_id TEXT NOT NULL UNIQUE,
  charges_enabled BOOLEAN NOT NULL DEFAULT false,
  payouts_enabled BOOLEAN NOT NULL DEFAULT false,
  details_submitted BOOLEAN NOT NULL DEFAULT false,
  country TEXT NULL,
  default_currency TEXT NOT NULL DEFAULT 'USD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS work_market_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES user_works(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_listen_price_cents BIGINT NOT NULL DEFAULT 0,
  current_buyout_price_cents BIGINT NULL,
  tips_enabled BOOLEAN NOT NULL DEFAULT true,
  buyout_enabled BOOLEAN NOT NULL DEFAULT false,
  visibility TEXT NOT NULL DEFAULT 'private',
  rights_scope TEXT NOT NULL DEFAULT 'personal_use',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(work_id)
);

CREATE TABLE IF NOT EXISTS work_access_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES user_works(id) ON DELETE CASCADE,
  owner_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_kind TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  amount_cents BIGINT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  stripe_price_id TEXT NULL,
  stripe_product_id TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(work_id, product_kind)
);

CREATE TABLE IF NOT EXISTS work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  seller_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  work_id UUID NOT NULL REFERENCES user_works(id) ON DELETE CASCADE,
  product_id UUID NULL REFERENCES work_access_products(id) ON DELETE SET NULL,
  order_kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  currency TEXT NOT NULL DEFAULT 'USD',
  gross_amount_cents BIGINT NOT NULL DEFAULT 0,
  platform_fee_cents BIGINT NOT NULL DEFAULT 0,
  seller_net_cents BIGINT NOT NULL DEFAULT 0,
  stripe_checkout_session_id TEXT NULL,
  stripe_payment_intent_id TEXT NULL,
  stripe_charge_id TEXT NULL,
  request_id TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS work_tips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NULL REFERENCES work_orders(id) ON DELETE SET NULL,
  work_id UUID NOT NULL REFERENCES user_works(id) ON DELETE CASCADE,
  tipper_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  owner_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  amount_cents BIGINT NOT NULL,
  message TEXT NULL,
  stripe_payment_intent_id TEXT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ownership_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL REFERENCES user_works(id) ON DELETE CASCADE,
  from_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  to_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  order_id UUID NULL REFERENCES work_orders(id) ON DELETE SET NULL,
  transfer_kind TEXT NOT NULL DEFAULT 'buyout',
  currency TEXT NOT NULL DEFAULT 'USD',
  transfer_amount_cents BIGINT NOT NULL DEFAULT 0,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payout_reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  stripe_connected_account_id UUID NULL REFERENCES stripe_connected_accounts(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  gross_amount_cents BIGINT NOT NULL DEFAULT 0,
  platform_fee_cents BIGINT NOT NULL DEFAULT 0,
  owner_net_cents BIGINT NOT NULL DEFAULT 0,
  stripe_transfer_id TEXT NULL,
  stripe_payout_id TEXT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  period_start TIMESTAMPTZ NULL,
  period_end TIMESTAMPTZ NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  livemode BOOLEAN NOT NULL DEFAULT false,
  payload JSONB NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ NULL,
  processing_error TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS stripe_customers_email_idx
  ON stripe_customers(email);

CREATE INDEX IF NOT EXISTS work_market_profiles_owner_idx
  ON work_market_profiles(owner_user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS work_access_products_owner_idx
  ON work_access_products(owner_user_id, product_kind, active);

CREATE INDEX IF NOT EXISTS work_orders_buyer_idx
  ON work_orders(buyer_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS work_orders_seller_idx
  ON work_orders(seller_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS work_orders_work_idx
  ON work_orders(work_id, created_at DESC);

CREATE INDEX IF NOT EXISTS work_tips_owner_idx
  ON work_tips(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ownership_transfers_work_idx
  ON ownership_transfers(work_id, effective_at DESC);

CREATE INDEX IF NOT EXISTS payout_reconciliations_owner_idx
  ON payout_reconciliations(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS stripe_webhook_events_processed_idx
  ON stripe_webhook_events(processed, created_at DESC);
