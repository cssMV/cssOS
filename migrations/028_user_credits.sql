-- CSSOS_PERSON_MV_WAVE29 20260508 — Jing
-- Creator credit ledger. Award credits when creator's MVs receive
-- forks (+5), uses (+1), or cross view thresholds (100/500/1000/
-- 5000/10000 → +1 each crossing). Spends arrive in wave 35+.
-- Idempotency on view thresholds is enforced via a unique partial
-- index on (user_id, reason, threshold).

CREATE TABLE IF NOT EXISTS user_credits (
  user_id          UUID PRIMARY KEY,
  balance          BIGINT NOT NULL DEFAULT 0,
  lifetime_earned  BIGINT NOT NULL DEFAULT 0,
  lifetime_spent   BIGINT NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  delta       BIGINT NOT NULL,
  reason      TEXT NOT NULL,
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS credit_events_user_idx
  ON credit_events (user_id, created_at DESC);

-- Idempotent dedup for mv_view_threshold awards: one row per (user, mv, threshold).
CREATE UNIQUE INDEX IF NOT EXISTS credit_events_view_threshold_uidx
  ON credit_events (user_id, ((payload->>'mv_id')), ((payload->>'threshold')))
 WHERE reason = 'mv_view_threshold';
