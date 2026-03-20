CREATE TABLE IF NOT EXISTS css_governance_timeline (
    timeline_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    event_kind TEXT NOT NULL,
    source_system TEXT NOT NULL,
    source_id TEXT NOT NULL,
    message TEXT NOT NULL,
    actor_user_id TEXT,
    credit_score_before INTEGER,
    credit_score_after INTEGER,
    credit_delta INTEGER,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_css_governance_timeline_subject
ON css_governance_timeline(subject_kind, subject_id);

CREATE INDEX IF NOT EXISTS idx_css_governance_timeline_event_kind
ON css_governance_timeline(event_kind);

CREATE TABLE IF NOT EXISTS css_credit_profiles (
    user_id TEXT PRIMARY KEY,
    score INTEGER NOT NULL,
    updated_at TIMESTAMP DEFAULT now()
);
