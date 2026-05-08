-- CSSOS_PERSON_MV_WAVE40 20260508 — Jing
-- Block / report tables for trust & safety.

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  reason     TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks (blocked_id);

CREATE TABLE IF NOT EXISTS content_reports (
  report_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id  UUID NOT NULL,
  target_kind  TEXT NOT NULL,
  target_id    TEXT NOT NULL,
  reason_code  TEXT NOT NULL,
  details      TEXT,
  status       TEXT NOT NULL DEFAULT 'open',
  reviewed_by  UUID,
  reviewed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_reports_status_idx
  ON content_reports (status, created_at DESC);
CREATE INDEX IF NOT EXISTS content_reports_target_idx
  ON content_reports (target_kind, target_id);
CREATE UNIQUE INDEX IF NOT EXISTS content_reports_dedupe_uidx
  ON content_reports (reporter_id, target_kind, target_id, ((created_at AT TIME ZONE 'UTC')::date));

ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TIMESTAMPTZ;
