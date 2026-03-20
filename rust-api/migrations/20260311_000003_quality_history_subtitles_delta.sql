ALTER TABLE run_quality_snapshots
  ADD COLUMN IF NOT EXISTS subtitles_audio_delta_s DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS subtitles_audio_max_delta_s DOUBLE PRECISION;

ALTER TABLE run_quality_latest
  ADD COLUMN IF NOT EXISTS subtitles_audio_delta_s DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS subtitles_audio_max_delta_s DOUBLE PRECISION;
