-- CSSOS_WAVE_111B 20260511 — Jing
-- cssOS auto-fingerprint for provenance + reverse lookup.
--
--   fingerprint_hash      — sha256[0:16] hex of the audio's ACRCloud fingerprint
--                            payload. Stable per (canonical AAC bytes) and
--                            forms the share/verify lookup key.
--   fingerprinted_at      — when the fingerprint was computed.
--   fingerprint_pushed    — true once the reference audio was pushed to our
--                            own ACRCloud bucket (B4, gated). Default false.

ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS fingerprint_hash TEXT;
ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS fingerprinted_at TIMESTAMPTZ;
ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS fingerprint_pushed BOOLEAN NOT NULL DEFAULT false;

-- Reverse-lookup index — must be fast for the /api/works/by-fingerprint
-- endpoint and the ?fp= alias route.
CREATE INDEX IF NOT EXISTS user_works_fingerprint_hash_idx
  ON user_works (fingerprint_hash) WHERE fingerprint_hash IS NOT NULL;
