-- CSSOS_WAVE94 20260508 — Jing — synthetic health probe log.
-- Records every HTTP/canary-MV/engine/db probe outcome. Additive only.

CREATE TABLE IF NOT EXISTS health_probe_log (
  id BIGSERIAL PRIMARY KEY,
  probe_kind TEXT NOT NULL,   -- 'http_health' | 'canary_mv' | 'engine_health' | 'db_query'
  target TEXT NOT NULL,
  ok BOOLEAN NOT NULL,
  duration_ms INTEGER,
  status_code INTEGER,
  detail JSONB,
  ts TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS health_probe_log_ts_idx
  ON health_probe_log (probe_kind, ts DESC);
CREATE INDEX IF NOT EXISTS health_probe_log_ok_ts_idx
  ON health_probe_log (ok, ts DESC);
