-- CSSOS_WAVE_413 20260524 — Jing「反对浪费，勤俭节约」
-- Suno (and any dual-clip engine) returns TWO takes per generation. The
-- main work already keeps both (Take 1 / Take 2 A/B). Language tracks were
-- throwing Take 2 away — pure waste of server compute the engine already
-- spent. Persist the second take so nothing the engine produced is lost.
--
-- Each take has its OWN duration (the engine renders them independently),
-- so we keep a separate alt_duration_secs. The watch player can A/B the two
-- takes per language, and a future wave can pair each take with its own
-- length-matched MV (一音轨配一MV, no borrowing).

ALTER TABLE work_language_tracks
  ADD COLUMN IF NOT EXISTS alt_audio_url     TEXT,
  ADD COLUMN IF NOT EXISTS alt_duration_secs INTEGER;
