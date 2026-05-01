-- CSSOS_PHASE2_BACKFILL 20260430 #221b — Strip ' · Take 2' from historical
-- Take 2 work titles + backfill sibling_work_id / take_index into both
-- siblings' final_mv_meta so the symmetric Watch toggle works for old rows.
BEGIN;

-- Step 1: strip the title suffix on Take 2 rows.
UPDATE user_works
SET title = REGEXP_REPLACE(title, '\s*·\s*[Tt]ake\s*2\s*$', '')
WHERE source_run_id LIKE '%::take2'
  AND title ~* '\s*·\s*take\s*2\s*$';

-- Step 2: patch Take 2's final_mv meta with sibling info.
WITH pairs AS (
  SELECT t2.id AS take2_id, t1.id AS take1_id
  FROM user_works t2
  JOIN user_works t1
    ON t1.source_run_id = REGEXP_REPLACE(t2.source_run_id, '::take2$', '')
   AND t1.id <> t2.id
  WHERE t2.source_run_id LIKE '%::take2'
)
UPDATE work_assets
SET meta = COALESCE(meta, '{}'::jsonb)
        || jsonb_build_object(
             'sibling_work_id', pairs.take1_id::text,
             'take_index', 2
           )
FROM pairs
WHERE work_assets.work_id = pairs.take2_id
  AND work_assets.asset_type = 'final_mv';

-- Step 3: patch Take 1's final_mv meta with sibling info.
WITH pairs AS (
  SELECT t2.id AS take2_id, t1.id AS take1_id
  FROM user_works t2
  JOIN user_works t1
    ON t1.source_run_id = REGEXP_REPLACE(t2.source_run_id, '::take2$', '')
   AND t1.id <> t2.id
  WHERE t2.source_run_id LIKE '%::take2'
)
UPDATE work_assets
SET meta = COALESCE(meta, '{}'::jsonb)
        || jsonb_build_object(
             'sibling_work_id', pairs.take2_id::text,
             'take_index', 1
           )
FROM pairs
WHERE work_assets.work_id = pairs.take1_id
  AND work_assets.asset_type = 'final_mv';

COMMIT;

\echo '--- titles after ---'
SELECT id, title FROM user_works
WHERE source_run_id LIKE '%::take2'
ORDER BY created_at DESC;

\echo '--- meta after ---'
SELECT wa.work_id, uw.title,
       wa.meta->>'take_index' AS take,
       wa.meta->>'sibling_work_id' AS sibling
FROM work_assets wa
JOIN user_works uw ON uw.id = wa.work_id
WHERE wa.asset_type = 'final_mv'
  AND wa.meta ? 'sibling_work_id'
ORDER BY uw.created_at DESC LIMIT 20;
