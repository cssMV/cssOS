-- CSSOS_WAVE_111 20260511 — Jing
-- Audio upload + custom lyrics import support.
--
--   import_source       — "generated" (default, full MV pipeline)
--                       | "custom_lyrics" (user pasted/uploaded lyrics, music generated)
--                       | "audio_upload"  (user uploaded mp3/wav, full bypass of music engine)
--                       | "audio+lyrics"  (both uploaded; skip lyrics+music stages)
--
--   requires_clearance  — true while fingerprint/copyright check is pending or unresolved.
--                         Marketplace listings are locked (no listen/buyout) until false.
--
--   skip_stages         — array of pipeline stages that were skipped for cost accounting:
--                         "lyrics" | "music" | "cover" | "video" | "subtitle" | "compose"
--                         Wave 113J cost calculator subtracts these from the floor estimate.
--
--   fingerprint_result  — JSONB cache of the latest ACRCloud response (artists, ISRC, ISWC,
--                         confidence, matched_at). Null until first fingerprint run.

ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS import_source TEXT NOT NULL DEFAULT 'generated';
ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS requires_clearance BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS skip_stages TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS fingerprint_result JSONB;

CREATE INDEX IF NOT EXISTS user_works_import_source_idx
  ON user_works (import_source);
CREATE INDEX IF NOT EXISTS user_works_requires_clearance_idx
  ON user_works (requires_clearance) WHERE requires_clearance = true;
