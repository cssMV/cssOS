-- CSSOS_WAVE_111C 20260512 — Jing
-- ACRCloud Management API push opt-in + audit trail.
--
--   user_settings.allow_global_fingerprint_push BOOLEAN
--     — creator opt-in. Default false. Only marketplace-public works
--       belonging to opted-in users are eligible for push.
--
--   acrcloud_push_log
--     — per-push audit: which work, when, our internal upload id,
--       ACRCloud-side bucket id, cost in cents. Used to enforce the
--       ACRCLOUD_MAX_PUSHES_PER_MONTH cap and to give creators a
--       receipt if they later request takedown.

CREATE TABLE IF NOT EXISTS user_fingerprint_optin (
  user_id              UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  allow_global_push    BOOLEAN NOT NULL DEFAULT false,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS acrcloud_push_log (
  id                   BIGSERIAL PRIMARY KEY,
  work_id              UUID NOT NULL REFERENCES user_works(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bucket_id            TEXT,            -- ACRCloud bucket the file landed in
  remote_audio_id      TEXT,            -- ACRCloud's id for this reference
  upload_status        TEXT NOT NULL,   -- "ok" | "rate_limited" | "error"
  cost_cents           INTEGER NOT NULL DEFAULT 0,
  error_detail         TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS acrcloud_push_log_work_idx ON acrcloud_push_log (work_id);
CREATE INDEX IF NOT EXISTS acrcloud_push_log_user_idx ON acrcloud_push_log (user_id);
CREATE INDEX IF NOT EXISTS acrcloud_push_log_created_idx ON acrcloud_push_log (created_at DESC);
