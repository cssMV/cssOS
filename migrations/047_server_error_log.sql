-- CSSOS_WAVE82 20260508 — Jing — server error log table.
-- Cheap fire-and-forget INSERT path for Express error handler + helper.
-- Additive only.

CREATE TABLE IF NOT EXISTS server_error_log (
  id BIGSERIAL PRIMARY KEY,
  level TEXT NOT NULL,
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  stack_snippet TEXT,
  user_id UUID,
  request_path TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS server_error_log_source_idx
  ON server_error_log (source, occurred_at DESC);
CREATE INDEX IF NOT EXISTS server_error_log_unresolved_idx
  ON server_error_log (occurred_at DESC) WHERE resolved_at IS NULL;
