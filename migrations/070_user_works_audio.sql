-- CSSOS_WAVE_122B 20260513 — Jing
-- Add preview_audio_url to user_works. The Wave 121 system-media
-- backfill worker fills lyrics + cover; Wave 122B extends to optional
-- audio (via callMusicGen) + video (via callVideoGen) on-demand
-- (per-click) when a user opens a still-bare system work.

ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS preview_audio_url TEXT NULL;
