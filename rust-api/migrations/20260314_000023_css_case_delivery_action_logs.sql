CREATE TABLE IF NOT EXISTS css_case_delivery_action_logs (
    action_log_id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    mode TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    result_message TEXT NOT NULL,
    payload_name TEXT,
    snapshot_id TEXT,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_action_logs_subject_key
ON css_case_delivery_action_logs(subject_key);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_action_logs_actor_user_id
ON css_case_delivery_action_logs(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_action_logs_action
ON css_case_delivery_action_logs(action);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_action_logs_created_at
ON css_case_delivery_action_logs(created_at);
