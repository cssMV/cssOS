-- CSSOS_WAVE_113K 20260511 — Jing
-- Real per-engine cost breakdown on user_works.
--
--   cost_breakdown JSONB — array of {stage, provider, model, cents, ts, ms}
--   one entry per third-party engine call that contributed to this work.
--   Frontend "Itemized breakdown" renders this directly instead of the
--   proportion-based decomposition fallback (still kept as backup).
--
-- Replaces / complements compute_cost_cents_estimate (which stays as
-- the rolled-up scalar total, equal to SUM of cost_breakdown[].cents).

ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS cost_breakdown JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS user_works_cost_breakdown_gin
  ON user_works USING GIN (cost_breakdown);
