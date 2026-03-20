ALTER TABLE run_quality_snapshots
  ADD COLUMN IF NOT EXISTS subtitles_audio_delta_before_s DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS subtitles_audio_delta_improved_s DOUBLE PRECISION;

ALTER TABLE run_quality_latest
  ADD COLUMN IF NOT EXISTS subtitles_audio_delta_before_s DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS subtitles_audio_delta_improved_s DOUBLE PRECISION;

