-- CSSOS_PERSON_MV_WAVE41 20260508 — Jing — admin trends dashboard.
-- Tracks per-user last_active_at so the admin DAU chart has real data
-- instead of guessing from auth provider timestamps. Throttled in
-- middleware to one update per 5 minutes per user, so write volume
-- is bounded even on heavy traffic.

ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS users_last_active_idx
  ON users (last_active_at DESC);
