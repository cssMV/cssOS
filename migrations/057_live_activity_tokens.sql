-- CSSOS_PHASE2_MODULE1 20260508 — Jing
-- iOS Live Activity push tokens for cinema MV pipeline progress.
-- Each Activity<CssosCinemaAttributes> requested with pushType: .token
-- yields a per-activity ephemeral token that the server uses to push
-- ContentState updates via APNs HTTP/2 (topic: <bundle>.push-type.liveactivity).
-- Tokens are short-lived (lifetime of the Live Activity) so we keep this
-- table additive and let rows go stale; cleanup is done by created_at age.
CREATE TABLE IF NOT EXISTS live_activity_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  run_id TEXT NOT NULL,
  push_token TEXT NOT NULL,
  bundle_id TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  UNIQUE (user_id, run_id, push_token)
);
CREATE INDEX IF NOT EXISTS live_activity_tokens_run_idx
  ON live_activity_tokens (run_id) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS live_activity_tokens_user_idx
  ON live_activity_tokens (user_id) WHERE enabled = true;
