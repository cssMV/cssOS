-- CSSOS_PERSON_MV_WAVE59_60 20260508 — Jing
-- Wave 59: engine health probe state — last status / latency / consecutive
-- failures / disabled_until + per-engine model_override (used when an upstream
-- default model 404s and a fallback in FALLBACK_MODELS works).
-- Wave 60: balance alert dedupe — one row per fired alert; index on
-- (engine_id, alerted_at DESC) lets the 24h dedupe check hit a single row.
-- Both additive; safe to re-run.

CREATE TABLE IF NOT EXISTS engine_health (
  engine_id TEXT PRIMARY KEY,
  last_check_at TIMESTAMPTZ,
  last_status TEXT,
  last_latency_ms INTEGER,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  model_override TEXT,
  disabled_until TIMESTAMPTZ,
  last_error_snippet TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS engine_health_disabled_idx
  ON engine_health (disabled_until)
  WHERE disabled_until IS NOT NULL;

CREATE TABLE IF NOT EXISTS engine_balance_alerts (
  id BIGSERIAL PRIMARY KEY,
  engine_id TEXT NOT NULL,
  balance_at_alert NUMERIC,
  threshold NUMERIC,
  alerted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS engine_balance_alerts_engine_idx
  ON engine_balance_alerts (engine_id, alerted_at DESC);
