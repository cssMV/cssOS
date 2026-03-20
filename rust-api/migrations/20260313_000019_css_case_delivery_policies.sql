CREATE TABLE IF NOT EXISTS css_case_delivery_policies (
    policy_id TEXT PRIMARY KEY,
    version INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL,
    policy_json JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_css_case_delivery_policies_active
ON css_case_delivery_policies(is_active);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_css_case_delivery_policies_active_true
ON css_case_delivery_policies(is_active)
WHERE is_active = true;
