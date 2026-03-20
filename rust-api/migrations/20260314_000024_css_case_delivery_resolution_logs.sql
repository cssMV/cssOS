CREATE TABLE IF NOT EXISTS css_case_delivery_resolution_logs (
    resolution_log_id TEXT PRIMARY KEY,
    target TEXT NOT NULL,
    mode TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    state TEXT NOT NULL,
    triggering_action TEXT,
    reasons JSONB NOT NULL,
    summary TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_resolution_logs_subject_key
ON css_case_delivery_resolution_logs(subject_key);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_resolution_logs_state
ON css_case_delivery_resolution_logs(state);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_resolution_logs_created_at
ON css_case_delivery_resolution_logs(created_at);
