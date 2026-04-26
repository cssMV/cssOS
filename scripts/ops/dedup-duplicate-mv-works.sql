-- CSSOS_PHASE2_AUTOSAVE 20260426 #147 — Jing
-- "Save as work不应该有这个按钮，我点了3次，作品中心/为你创作都有3个重复的作品。"
--
-- One-shot cleanup for the duplicate rows the deprecated manual button left
-- behind. Groups user_works rows by (user_id, source_run_id, final_mv_url)
-- and keeps the EARLIEST row per group — every later sibling is soft-deleted
-- (status='deleted') so it disappears from Works Center / For You without
-- losing the audit trail.
--
-- Usage on api-vm:
--   psql -d cssos -f scripts/ops/dedup-duplicate-mv-works.sql
--
-- Idempotent: re-running is a no-op once each (user_id, source_run_id) group
-- is collapsed to a single non-deleted row.

BEGIN;

-- 1) Identify duplicate groups: same user, same source_run_id (= mv_id), >1 row.
WITH duplicates AS (
  SELECT
    id,
    user_id,
    source_run_id,
    created_at,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, source_run_id
      ORDER BY created_at ASC, id ASC
    ) AS rn
  FROM user_works
  WHERE source_run_id IS NOT NULL
    AND source_run_id <> ''
    AND status <> 'deleted'
)
-- 2) Show what we're about to soft-delete (run with EXPLAIN-only first if cautious).
SELECT
  user_id,
  source_run_id,
  COUNT(*) FILTER (WHERE rn > 1) AS dup_count,
  array_agg(id ORDER BY created_at) FILTER (WHERE rn > 1) AS dup_ids
FROM duplicates
WHERE rn > 1
GROUP BY user_id, source_run_id
ORDER BY dup_count DESC
LIMIT 25;

-- 3) Soft-delete the dupes (rn > 1 in the same partition).
UPDATE user_works
SET status = 'deleted',
    updated_at = NOW()
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY user_id, source_run_id
        ORDER BY created_at ASC, id ASC
      ) AS rn
    FROM user_works
    WHERE source_run_id IS NOT NULL
      AND source_run_id <> ''
      AND status <> 'deleted'
  ) ranked
  WHERE rn > 1
);

-- 4) Print final tally so the operator can confirm.
SELECT
  COUNT(*) AS total_rows,
  COUNT(*) FILTER (WHERE status = 'deleted') AS soft_deleted,
  COUNT(*) FILTER (WHERE status = 'ready')   AS ready
FROM user_works
WHERE source_run_id IS NOT NULL
  AND source_run_id <> '';

COMMIT;
