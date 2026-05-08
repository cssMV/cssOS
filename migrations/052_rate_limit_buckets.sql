-- CSSOS_WAVE103 20260508 — Jing — unified rate limiter (DB-backed bucket).
-- Multi-process-safe shared bucket. In-memory backend remains for dev.
-- Additive only.

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  key TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  last_hit TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_last_hit_idx
  ON rate_limit_buckets (last_hit);
