CREATE TABLE IF NOT EXISTS css_policy_versions (
    version_id TEXT PRIMARY KEY,
    version_name TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    policy_bundle_json JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS css_policy_bindings (
    binding_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    version_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_css_policy_bindings_subject
ON css_policy_bindings(subject_kind, subject_id);

CREATE INDEX IF NOT EXISTS idx_css_policy_bindings_version
ON css_policy_bindings(version_id);
