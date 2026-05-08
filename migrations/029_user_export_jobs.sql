-- CSSOS_PERSON_MV_WAVE33 20260508 — Jing
-- GDPR data export jobs. POST /api/user/export kicks off an async
-- worker that ZIPs the user's profile + MVs + comments + likes +
-- views + subscriptions + templates and saves it to artifacts/exports.
-- Jobs auto-expire after 7 days; daily cron purges expired ZIPs.

CREATE TABLE IF NOT EXISTS user_export_jobs (
  job_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  download_url  TEXT,
  expires_at    TIMESTAMPTZ,
  error         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS user_export_jobs_user_idx
  ON user_export_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_export_jobs_expires_idx
  ON user_export_jobs (expires_at) WHERE expires_at IS NOT NULL;
