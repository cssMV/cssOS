-- CSSOS_WAVE_107_IOS_OAUTH_HANDOFF 20260509 — Jing
-- One-shot handoff tokens for iOS-native OAuth (Google/GitHub/Facebook/etc.).
-- Issued at the OAuth callback when intent=ios-app, redeemed by the
-- Capacitor app inside its WKWebView session via /api/auth/handoff/exchange.
-- TTL=90s, single-use, atomic redemption (UPDATE ... RETURNING with
-- used_at IS NULL AND expires_at > now()) prevents replay.
CREATE TABLE IF NOT EXISTS oauth_handoff_tokens (
  token         TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  provider      TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  used_at       TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS oauth_handoff_tokens_expires_idx
  ON oauth_handoff_tokens (expires_at);
CREATE INDEX IF NOT EXISTS oauth_handoff_tokens_user_idx
  ON oauth_handoff_tokens (user_id);
