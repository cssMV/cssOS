-- CSSOS_PERSON_MV_WAVE78 20260508 — Jing
-- Weekly email digest: per-user opt-in flag, last-sent stamp, send log,
-- and email-verified column on users (additive, defaults preserve
-- existing behaviour — pre-existing users with non-null email are
-- treated as unverified until they confirm).

ALTER TABLE users ADD COLUMN IF NOT EXISTS email_digest_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_digest_last_sent_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS email_digest_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  digest_kind TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  subject TEXT,
  status TEXT NOT NULL,
  error_snippet TEXT
);
CREATE INDEX IF NOT EXISTS email_digest_log_user_idx ON email_digest_log (user_id, sent_at DESC);
