CREATE TABLE IF NOT EXISTS css_signals_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    signals_bundle_json JSONB NOT NULL,
    related_audit_id TEXT,
    related_review_id TEXT,
    related_deal_id TEXT,
    related_dispute_id TEXT,
    source_system TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_css_signals_snapshots_subject
ON css_signals_snapshots(subject_kind, subject_id);

CREATE INDEX IF NOT EXISTS idx_css_signals_snapshots_purpose
ON css_signals_snapshots(purpose);

CREATE INDEX IF NOT EXISTS idx_css_signals_snapshots_audit
ON css_signals_snapshots(related_audit_id);

CREATE INDEX IF NOT EXISTS idx_css_signals_snapshots_review
ON css_signals_snapshots(related_review_id);

CREATE INDEX IF NOT EXISTS idx_css_signals_snapshots_deal
ON css_signals_snapshots(related_deal_id);

CREATE INDEX IF NOT EXISTS idx_css_signals_snapshots_dispute
ON css_signals_snapshots(related_dispute_id);
