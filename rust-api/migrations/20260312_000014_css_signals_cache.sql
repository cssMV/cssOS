CREATE TABLE IF NOT EXISTS css_signals_cache (
    cache_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    signals_bundle_json JSONB NOT NULL,
    generated_at TIMESTAMP NOT NULL,
    expires_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_css_signals_cache_subject
ON css_signals_cache(subject_kind, subject_id);

CREATE INDEX IF NOT EXISTS idx_css_signals_cache_expires_at
ON css_signals_cache(expires_at);
