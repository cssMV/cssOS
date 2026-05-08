-- CSSOS_WAVE80 20260508 — Jing — web-vitals telemetry.
-- Stores client-reported Core Web Vitals samples for trend analysis.
-- Additive only: no constraints on existing tables.

CREATE TABLE IF NOT EXISTS web_vitals_samples (
  id BIGSERIAL PRIMARY KEY,
  route TEXT,
  metric TEXT NOT NULL,
  value DOUBLE PRECISION NOT NULL,
  ua TEXT,
  user_id UUID,
  ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_web_vitals_samples_metric_ts
  ON web_vitals_samples (metric, ts DESC);
CREATE INDEX IF NOT EXISTS idx_web_vitals_samples_route
  ON web_vitals_samples (route);
