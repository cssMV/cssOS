-- CSSOS Wave 102 — pg_dump backup log table.
CREATE TABLE IF NOT EXISTS db_backups (
  id BIGSERIAL PRIMARY KEY,
  r2_key TEXT NOT NULL,
  size_bytes BIGINT,
  sha256 TEXT,
  duration_ms INTEGER,
  status TEXT NOT NULL,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS db_backups_created_idx ON db_backups (created_at DESC);
