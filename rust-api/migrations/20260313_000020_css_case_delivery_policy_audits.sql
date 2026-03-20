CREATE TABLE IF NOT EXISTS css_case_delivery_policy_audits (
    audit_id TEXT PRIMARY KEY,
    action TEXT NOT NULL,
    actor_user_id TEXT,
    policy_id TEXT,
    version INTEGER,
    from_policy_id TEXT,
    from_version INTEGER,
    to_policy_id TEXT,
    to_version INTEGER,
    message TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_audits_policy
ON css_case_delivery_policy_audits(policy_id);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_audits_actor
ON css_case_delivery_policy_audits(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_audits_action
ON css_case_delivery_policy_audits(action);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policy_audits_created_at
ON css_case_delivery_policy_audits(created_at);
