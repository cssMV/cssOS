ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS source_run_id TEXT NULL,
  ADD COLUMN IF NOT EXISTS compute_units_estimate BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS compute_cost_cents_estimate BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suggested_listen_price_cents BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS suggested_buyout_price_cents BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS user_works_source_run_id_idx
  ON user_works(source_run_id);
