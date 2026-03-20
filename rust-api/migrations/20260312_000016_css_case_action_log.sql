CREATE TABLE IF NOT EXISTS css_case_action_logs (
    log_id TEXT PRIMARY KEY,
    case_id TEXT NOT NULL,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    action TEXT NOT NULL,
    actor_user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    accepted BOOLEAN NOT NULL,
    result_message TEXT NOT NULL,
    review_id TEXT,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_css_case_action_logs_case
ON css_case_action_logs(case_id);

CREATE INDEX IF NOT EXISTS idx_css_case_action_logs_subject
ON css_case_action_logs(subject_kind, subject_id);

CREATE INDEX IF NOT EXISTS idx_css_case_action_logs_actor
ON css_case_action_logs(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_css_case_action_logs_action
ON css_case_action_logs(action);

CREATE INDEX IF NOT EXISTS idx_css_case_action_logs_review
ON css_case_action_logs(review_id);
