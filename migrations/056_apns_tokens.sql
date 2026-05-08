-- CSSOS_PERSON_MV_WAVE98B 20260508 — Jing
-- Native iOS APNs push tokens. Web Push (Wave 32 + 89) covers browsers;
-- this table stores Apple device tokens registered by the Capacitor iOS
-- shell so the server can fan out APNs notifications alongside web push.
CREATE TABLE IF NOT EXISTS apns_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  device_token TEXT NOT NULL,
  bundle_id TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'ios',
  app_version TEXT,
  device_model TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, device_token)
);
CREATE INDEX IF NOT EXISTS apns_tokens_user_idx
  ON apns_tokens (user_id) WHERE enabled = true;
