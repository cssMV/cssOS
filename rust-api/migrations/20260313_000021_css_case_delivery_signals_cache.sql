CREATE TABLE css_case_delivery_signals_cache (
    cache_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_key TEXT NOT NULL UNIQUE,
    payload_json JSONB NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

CREATE UNIQUE INDEX uniq_css_case_delivery_signals_cache_subject
ON css_case_delivery_signals_cache(subject_key);

CREATE INDEX idx_css_case_delivery_signals_cache_updated_at
ON css_case_delivery_signals_cache(updated_at);
