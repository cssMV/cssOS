CREATE TABLE IF NOT EXISTS run_quality_snapshots (
  id BIGSERIAL PRIMARY KEY,
  run_id TEXT NOT NULL,
  seq BIGINT NOT NULL,
  ts TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  milestone_ready BOOLEAN NOT NULL,
  blocking_gate TEXT,
  breakdown_json JSONB NOT NULL,
  summary_json JSONB,
  UNIQUE(run_id, seq)
);

CREATE INDEX IF NOT EXISTS idx_run_quality_snapshots_run_id_ts
ON run_quality_snapshots(run_id, ts);

CREATE INDEX IF NOT EXISTS idx_run_quality_snapshots_run_id_seq
ON run_quality_snapshots(run_id, seq);

CREATE TABLE IF NOT EXISTS run_quality_latest (
  run_id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,
  quality_score INTEGER NOT NULL,
  quality_max INTEGER NOT NULL,
  milestone_ready BOOLEAN NOT NULL,
  blocking_gate TEXT,
  primary_lang TEXT,
  title_hint TEXT,
  artifacts_present_json JSONB NOT NULL,
  final_mv_bytes BIGINT,
  latest_seq BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_run_quality_latest_score
ON run_quality_latest(quality_score DESC);

CREATE INDEX IF NOT EXISTS idx_run_quality_latest_milestone
ON run_quality_latest(milestone_ready, quality_score DESC);

CREATE INDEX IF NOT EXISTS idx_run_quality_latest_updated_at
ON run_quality_latest(updated_at DESC);
