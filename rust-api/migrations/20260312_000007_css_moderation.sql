CREATE TABLE IF NOT EXISTS css_moderation_cases (
    moderation_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    level TEXT NOT NULL,
    action TEXT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_css_moderation_subject
ON css_moderation_cases(subject_kind, subject_id);
