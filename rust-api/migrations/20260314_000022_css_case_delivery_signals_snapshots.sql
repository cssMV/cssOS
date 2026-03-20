CREATE TABLE IF NOT EXISTS css_case_delivery_signals_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    reason TEXT NOT NULL,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_signals_snapshots_subject_key
ON css_case_delivery_signals_snapshots(subject_key);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_signals_snapshots_reason
ON css_case_delivery_signals_snapshots(reason);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_signals_snapshots_created_at
ON css_case_delivery_signals_snapshots(created_at);
