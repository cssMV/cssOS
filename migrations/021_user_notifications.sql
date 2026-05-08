-- CSSOS_PERSON_MV_WAVE20 20260508 — Jing
-- Notification system: likes / comments / follows on a user's MVs.
CREATE TABLE IF NOT EXISTS user_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,             -- recipient
  kind TEXT NOT NULL,                -- "mv_like" | "mv_comment" | "follow" | "system"
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_notifications_user_unread_idx
  ON user_notifications (user_id, read_at) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS user_notifications_user_recent_idx
  ON user_notifications (user_id, created_at DESC);
