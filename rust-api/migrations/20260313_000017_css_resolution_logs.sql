CREATE TABLE IF NOT EXISTS css_resolution_logs (
    log_id TEXT PRIMARY KEY,
    resolution_id TEXT NOT NULL,
    case_id TEXT NOT NULL,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    status TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    is_closed_like BOOLEAN NOT NULL,
    review_id TEXT,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_css_resolution_logs_case
ON css_resolution_logs(case_id);

CREATE INDEX IF NOT EXISTS idx_css_resolution_logs_subject
ON css_resolution_logs(subject_kind, subject_id);

CREATE INDEX IF NOT EXISTS idx_css_resolution_logs_status
ON css_resolution_logs(status);

CREATE INDEX IF NOT EXISTS idx_css_resolution_logs_actor
ON css_resolution_logs(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_css_resolution_logs_review
ON css_resolution_logs(review_id);

CREATE INDEX IF NOT EXISTS idx_css_resolution_logs_resolution
ON css_resolution_logs(resolution_id);
