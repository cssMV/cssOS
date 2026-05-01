-- NihaoPay integration (SecurePay hosted checkout).
--
-- Covers four intent kinds:
--   topup         — user tops up their billing balance
--   subscription  — user upgrades membership_tier (Plan A monthly redirect)
--   purchase      — marketplace item purchase (10% platform fee → creator_payouts)
--   tip           — user tips another user (0% platform fee → creator_payouts)
--
-- Rationale for a dedicated payments table (not reusing billing_fund_holds):
-- gateway-specific fields (vendor, reference, nihaopay_txn_id, raw_ipn) and
-- the webhook dedupe table are orthogonal to the wallet ledger. The ledger
-- still sees the money via credit_balance() calls after IPN settles.

CREATE TABLE IF NOT EXISTS payment_intents (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ,

  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind                 TEXT NOT NULL CHECK (kind IN ('topup','subscription','purchase','tip')),
  amount_cents         BIGINT NOT NULL CHECK (amount_cents > 0),
  currency             TEXT NOT NULL DEFAULT 'USD',

  -- Gateway-specific.
  gateway              TEXT NOT NULL DEFAULT 'nihaopay',
  vendor               TEXT NOT NULL CHECK (vendor IN ('alipay','wechatpay','unionpay')),
  reference            TEXT NOT NULL UNIQUE,         -- ≤30 alphanumeric; our idempotency key
  nihaopay_txn_id      TEXT UNIQUE,                  -- assigned by gateway on /securepay response
  status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','redirected','settling','paid',
                                           'failed','expired','refunded')),

  -- Intent-kind specific targets (nullable, only one set per kind).
  target_creator_id    UUID REFERENCES users(id) ON DELETE SET NULL,   -- tip / purchase
  target_item_id       UUID,                                            -- purchase (marketplace item)
  tier                 TEXT,                                            -- subscription target tier

  -- Free-form fields.
  note                 TEXT,                   -- echoed in IPN (we tag intent_type here)
  metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_ipn              JSONB                   -- last IPN body we received, for audit
);

CREATE INDEX IF NOT EXISTS payment_intents_user_time_idx
  ON payment_intents (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_intents_status_idx
  ON payment_intents (status, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_intents_creator_idx
  ON payment_intents (target_creator_id, status, completed_at DESC)
  WHERE target_creator_id IS NOT NULL;


-- Raw webhook log. Every IPN we receive from NihaoPay lands here first, BEFORE
-- we mutate payment_intents or the ledger. The (reference, nihaopay_txn_id,
-- status) tuple gives us idempotency — NihaoPay retries up to 8 times and we
-- must not double-credit. Keeps the full body for manual audit if verify_sign
-- ever disagrees with our reconstruction.
CREATE TABLE IF NOT EXISTS gateway_webhook_events (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at         TIMESTAMPTZ,

  gateway              TEXT NOT NULL DEFAULT 'nihaopay',
  reference            TEXT,            -- intent reference echoed back
  nihaopay_txn_id      TEXT,
  status               TEXT,            -- success/failed/... as reported by gateway
  verify_sign_valid    BOOLEAN NOT NULL DEFAULT FALSE,
  ip_addr              TEXT,          -- stored as text, not INET, to avoid
                                       -- sqlx needing the `ipnetwork` feature

  raw_payload          JSONB NOT NULL,  -- full form-urlencoded payload as JSON
  error               TEXT              -- set if we refused to process (bad sig, unknown ref, etc.)
);

CREATE INDEX IF NOT EXISTS gateway_webhook_events_ref_idx
  ON gateway_webhook_events (reference, received_at DESC);

CREATE INDEX IF NOT EXISTS gateway_webhook_events_unprocessed_idx
  ON gateway_webhook_events (received_at DESC)
  WHERE processed_at IS NULL;


-- Creator-owed balances accrued from tips + marketplace purchases.
-- We do NOT push money to creators via NihaoPay Profit Sharing (that only
-- works between NihaoPay merchants). Instead we record what we owe; payouts
-- are batched manually (or via a future payout pipeline).
--   gross_cents          = amount the buyer paid
--   platform_fee_cents   = our cut (0% on tips, 10% on purchases)
--   net_cents            = gross - platform_fee
CREATE TABLE IF NOT EXISTS creator_payouts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at         TIMESTAMPTZ,
  paid_at              TIMESTAMPTZ,

  creator_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  intent_id            UUID NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,

  kind                 TEXT NOT NULL CHECK (kind IN ('tip','purchase')),
  gross_cents          BIGINT NOT NULL CHECK (gross_cents > 0),
  platform_fee_cents   BIGINT NOT NULL CHECK (platform_fee_cents >= 0),
  net_cents            BIGINT NOT NULL CHECK (net_cents >= 0),
  currency             TEXT NOT NULL DEFAULT 'USD',

  payout_status        TEXT NOT NULL DEFAULT 'accrued'
                         CHECK (payout_status IN ('accrued','scheduled','paid','voided')),
  payout_batch_id      UUID,
  note                 TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS creator_payouts_intent_uniq
  ON creator_payouts (intent_id);

CREATE INDEX IF NOT EXISTS creator_payouts_creator_status_idx
  ON creator_payouts (creator_id, payout_status, created_at DESC);
