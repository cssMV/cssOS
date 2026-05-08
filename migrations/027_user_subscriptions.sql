-- CSSOS_PERSON_MV_WAVE26 20260508 — Jing
-- Subscriptions / RSS feed. Users subscribe to creators / persons /
-- groups; new MVs from those targets surface in /api/person-mv/feed
-- and the RSS endpoint. RSS uses a per-user opaque token stored on
-- users.rss_token (additive ALTER, lazily generated).

CREATE TABLE IF NOT EXISTS user_subscriptions (
  user_id      UUID NOT NULL,
  target_kind  TEXT NOT NULL CHECK (target_kind IN ('creator','person','group')),
  target_id    TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_kind, target_id)
);

CREATE INDEX IF NOT EXISTS user_subs_target_idx
  ON user_subscriptions (target_kind, target_id);
CREATE INDEX IF NOT EXISTS user_subs_user_idx
  ON user_subscriptions (user_id, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS rss_token TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_rss_token_idx
  ON users (rss_token) WHERE rss_token IS NOT NULL;
