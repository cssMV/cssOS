CREATE TABLE IF NOT EXISTS css_policy_migrations (
    migration_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    from_version_id TEXT NOT NULL,
    to_version_id TEXT NOT NULL,
    status TEXT NOT NULL,
    reason TEXT NOT NULL,
    requested_by_user_id TEXT,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_css_policy_migrations_subject
ON css_policy_migrations(subject_kind, subject_id);

CREATE INDEX IF NOT EXISTS idx_css_policy_migrations_status
ON css_policy_migrations(status);
