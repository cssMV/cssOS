-- CSSOS_PERSON_MV_WAVE32 20260508 — Jing
-- Web Push subscription storage. Each row binds a browser
-- pushManager subscription (endpoint + p256dh/auth keys) to a
-- cssOS user_id so the server can fan out push notifications via
-- VAPID-signed POSTs even when the tab is closed.

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  endpoint TEXT NOT NULL,
  keys JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS web_push_subs_endpoint_idx
  ON web_push_subscriptions (endpoint);

CREATE INDEX IF NOT EXISTS web_push_subs_user_idx
  ON web_push_subscriptions (user_id);
