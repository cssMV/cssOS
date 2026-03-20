CREATE TABLE IF NOT EXISTS css_rule_audits (
    audit_id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    policy_version_id TEXT NOT NULL,
    checks_json JSONB NOT NULL,
    final_decision TEXT NOT NULL,
    final_code TEXT NOT NULL,
    final_message TEXT NOT NULL,
    source_system TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_css_rule_audits_actor
ON css_rule_audits(actor_user_id);

CREATE INDEX IF NOT EXISTS idx_css_rule_audits_subject
ON css_rule_audits(subject_kind, subject_id);

CREATE INDEX IF NOT EXISTS idx_css_rule_audits_action
ON css_rule_audits(action);

CREATE INDEX IF NOT EXISTS idx_css_rule_audits_policy_version
ON css_rule_audits(policy_version_id);
