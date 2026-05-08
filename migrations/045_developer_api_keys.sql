-- CSSOS_PERSON_MV_WAVE75 20260508 — Jing
-- Developer API keys for /api/v1/* surface. Plaintext token returned ONCE on
-- create; we store SHA-256 hash + first 8 chars for display. Per-key rate
-- limit enforced in-process by token bucket (default 60/min).
CREATE TABLE IF NOT EXISTS api_keys (
  key_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL,
  key_prefix          TEXT NOT NULL,
  key_hash            TEXT NOT NULL,
  name                TEXT NOT NULL,
  scopes              TEXT[] NOT NULL DEFAULT '{read}',
  rate_limit_per_min  INTEGER NOT NULL DEFAULT 60,
  last_used_at        TIMESTAMPTZ,
  enabled             BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_keys_user_idx   ON api_keys (user_id);
CREATE INDEX IF NOT EXISTS api_keys_prefix_idx ON api_keys (key_prefix);
