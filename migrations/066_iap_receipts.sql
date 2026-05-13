-- CSSOS_WAVE_118 20260513 — Jing
-- Apple IAP receipt audit + idempotent grant.
--
--   iap_receipts — one row per StoreKit transaction the client posted
--                  to our /api/iap/apple/verify endpoint. Apple's
--                  transaction_id is globally unique per purchase, so
--                  we PRIMARY KEY on it for idempotency: the same
--                  receipt posted twice never double-grants.

CREATE TABLE IF NOT EXISTS iap_receipts (
  transaction_id     TEXT PRIMARY KEY,
  original_transaction_id TEXT,
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id         TEXT NOT NULL,           -- App Store Connect product id
  product_kind       TEXT NOT NULL,           -- subscription | credit_pack | unlock
  amount_cents       INTEGER NOT NULL DEFAULT 0,
  currency           TEXT NOT NULL DEFAULT 'USD',
  purchased_at       TIMESTAMPTZ NOT NULL,
  expires_at         TIMESTAMPTZ,             -- subscription expiry (null for one-time)
  environment        TEXT NOT NULL DEFAULT 'Production', -- "Sandbox" or "Production"
  app_account_token  TEXT,                    -- StoreKit2 appAccountToken (UUID we passed at purchase)
  raw_payload        JSONB,                   -- full receipt for audit
  granted            BOOLEAN NOT NULL DEFAULT false, -- did we credit the user?
  granted_at         TIMESTAMPTZ,
  refunded           BOOLEAN NOT NULL DEFAULT false,
  refunded_at        TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS iap_receipts_user_idx ON iap_receipts (user_id);
CREATE INDEX IF NOT EXISTS iap_receipts_product_idx ON iap_receipts (product_id);
CREATE INDEX IF NOT EXISTS iap_receipts_expires_idx ON iap_receipts (expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS iap_receipts_original_tx_idx ON iap_receipts (original_transaction_id) WHERE original_transaction_id IS NOT NULL;
