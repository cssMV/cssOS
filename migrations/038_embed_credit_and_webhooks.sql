-- CSSOS_PERSON_MV_WAVE56_57 20260508 — Jing
-- Wave 56: embed-credit removal shop item is seeded at runtime
--           (see seedShopAndContestOnce in src/index.ts), schema lives in
--           migrations/032_credit_shop.sql. No new column needed.
-- Wave 57: user-defined outbound webhooks + delivery log.

CREATE TABLE IF NOT EXISTS user_webhooks (
  webhook_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  url               TEXT NOT NULL,
  event_kinds       TEXT[] NOT NULL DEFAULT '{}',
  secret            TEXT NOT NULL,
  enabled           BOOLEAN NOT NULL DEFAULT true,
  last_delivery_at  TIMESTAMPTZ,
  last_status_code  INTEGER,
  failure_count     INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_webhooks_user_idx
  ON user_webhooks (user_id);
CREATE INDEX IF NOT EXISTS user_webhooks_kinds_idx
  ON user_webhooks USING GIN (event_kinds);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id                BIGSERIAL PRIMARY KEY,
  webhook_id        UUID NOT NULL,
  event_kind        TEXT NOT NULL,
  payload           JSONB NOT NULL,
  status_code       INTEGER,
  response_snippet  TEXT,
  duration_ms       INTEGER,
  attempt           INTEGER NOT NULL DEFAULT 1,
  delivered_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS webhook_deliveries_webhook_idx
  ON webhook_deliveries (webhook_id, delivered_at DESC);
