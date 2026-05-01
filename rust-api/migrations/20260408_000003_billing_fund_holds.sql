CREATE TABLE IF NOT EXISTS billing_fund_holds (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  amount_cents  BIGINT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',
  note          TEXT,
  available_at  TIMESTAMPTZ NOT NULL,
  released_at   TIMESTAMPTZ,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS billing_fund_holds_user_time_idx
  ON billing_fund_holds (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS billing_fund_holds_user_status_idx
  ON billing_fund_holds (user_id, status, available_at ASC);
