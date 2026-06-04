-- CSSOS_WAVE_166 20260515 — Jing
-- One-shot backfill: populate user_works.duration_secs for every row
-- whose column is NULL/0 but whose work_assets meta has duration_secs.
-- Prefer final_mv (the composed MV's true duration) over audio_track_1
-- (the raw vocal track, usually the same but occasionally trimmed).
--
-- Run once:
--   ssh api-vm 'sudo -u postgres psql cssos -f -' < scripts/backfill-work-duration-secs.sql
--
-- Idempotent: only updates rows currently missing a duration, never
-- clobbers a value that's already there.

BEGIN;

WITH source AS (
  SELECT
    wa.work_id,
    COALESCE(
      MAX((wa.meta->>'duration_secs')::float)
        FILTER (WHERE wa.asset_type = 'final_mv'),
      MAX((wa.meta->>'duration_secs')::float)
        FILTER (WHERE wa.asset_type = 'audio_track_1')
    ) AS dur
  FROM work_assets wa
  WHERE wa.asset_type IN ('final_mv', 'audio_track_1')
    AND wa.meta ? 'duration_secs'
    AND (wa.meta->>'duration_secs') ~ '^[0-9]+(\.[0-9]+)?$'
  GROUP BY wa.work_id
)
UPDATE user_works w
   SET duration_secs = ROUND(s.dur)::int,
       updated_at = now()
  FROM source s
 WHERE w.id = s.work_id
   AND s.dur IS NOT NULL
   AND s.dur > 0
   AND s.dur <= 3600
   AND (w.duration_secs IS NULL OR w.duration_secs = 0);

-- Diagnostic readout: how many rows now have a duration vs. still missing.
SELECT
  COUNT(*) FILTER (WHERE duration_secs > 0)  AS with_duration,
  COUNT(*) FILTER (WHERE duration_secs IS NULL OR duration_secs = 0) AS missing,
  COUNT(*) AS total
FROM user_works
WHERE parent_work_id IS NULL;

COMMIT;
