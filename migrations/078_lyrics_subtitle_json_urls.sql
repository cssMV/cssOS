-- CSSOS_WAVE_440 20260525 — Jing「两个JSON文件·情绪字幕架构」
-- Add three CDN URL columns to user_works:
--   lyrics_json_url           → cdn.cssstudio.app/works/{id}/lyrics.json
--   subtitle_take1_json_url   → cdn.cssstudio.app/works/{id}/subtitle-take1.json
--   subtitle_take2_json_url   → cdn.cssstudio.app/works/{id}/subtitle-take2.json
--
-- The JSON files are built + uploaded by renderLanguageTrack (W440).
-- The DB columns are the authoritative pointers; the JSON files are the
-- source of truth for lyrics content (replaces work_language_tracks.lyrics).
-- lyrics col is kept for backward-compat and legacy fallback.

ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS lyrics_json_url        TEXT,
  ADD COLUMN IF NOT EXISTS subtitle_take1_json_url TEXT,
  ADD COLUMN IF NOT EXISTS subtitle_take2_json_url TEXT;

CREATE INDEX IF NOT EXISTS user_works_lyrics_json_idx
  ON user_works (id) WHERE lyrics_json_url IS NOT NULL;
