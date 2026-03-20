CREATE TABLE IF NOT EXISTS css_review_items (
    review_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    priority TEXT NOT NULL,
    status TEXT NOT NULL,
    source_action TEXT NOT NULL,
    source_code TEXT NOT NULL,
    reason TEXT NOT NULL,
    actor_user_id TEXT,
    assigned_reviewer_id TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_css_review_subject
ON css_review_items(subject_kind, subject_id);

CREATE INDEX IF NOT EXISTS idx_css_review_status
ON css_review_items(status);

CREATE INDEX IF NOT EXISTS idx_css_review_priority
ON css_review_items(priority);

CREATE TABLE IF NOT EXISTS css_review_decisions (
    decision_id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL,
    decision TEXT NOT NULL,
    comment TEXT NOT NULL,
    reviewer_user_id TEXT NOT NULL,
    decided_at TIMESTAMP NOT NULL
);
