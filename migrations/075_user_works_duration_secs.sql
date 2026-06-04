-- CSSOS_WAVE_166 20260515 — Jing
-- Add user_works.duration_secs so card-render SQL doesn't have to dig
-- into work_assets.meta JSON every read. New rows get it populated by
-- POST /api/works body.duration_secs; historical rows are filled by
-- scripts/backfill-work-duration-secs.sql.

ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS duration_secs INTEGER;

-- Optional sanity check (commented): durations should be 0..3600.
-- ALTER TABLE user_works
--   ADD CONSTRAINT user_works_duration_secs_range
--   CHECK (duration_secs IS NULL OR (duration_secs >= 0 AND duration_secs <= 3600));
