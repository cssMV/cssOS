CREATE TABLE IF NOT EXISTS css_reputation_profiles (
    user_id TEXT PRIMARY KEY,
    score INTEGER NOT NULL,
    level TEXT NOT NULL,
    violation_count INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS css_reputation_events (
    event_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    violation_kind TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE TABLE IF NOT EXISTS css_reputation_penalties (
    penalty_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    starts_at TIMESTAMP,
    ends_at TIMESTAMP,
    reason TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_css_reputation_events_user
ON css_reputation_events(user_id);

CREATE INDEX IF NOT EXISTS idx_css_reputation_penalties_user
ON css_reputation_penalties(user_id);
