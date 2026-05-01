#!/bin/bash
# CSSOS_PHASE2_BACKFILL_PLAYABLE 20260430 #214 — Jing
#
# Pre-#214 commit handler dropped the final_mv URL on the floor (or rather,
# it stored it in work_assets but DIDN'T also overwrite user_works.preview_video_url).
# The Node /api/works/mine handler reads preview_video_url, so old works
# that DO have a final_mv asset never surface it on reload — user has to
# re-run the pipeline.
#
# Backfill:
#   For every user_works row whose preview_video_url is null or empty,
#   try to find a final_mv work_asset for that work_id and copy its URL
#   into preview_video_url. Audio tracks (kie.ai tempfile URLs) have long
#   since expired and can't be backfilled — those works will play silent
#   final mp4s, which is still better than the current "click triggers a
#   re-run" behaviour.
#
# Usage:  ssh api-vm 'bash /tmp/backfill-work-assets-214.sh'  (after scp)
set -u
PGURL="postgres://cssstudio:Au%2320016@127.0.0.1:5432/cssstudio?sslmode=disable"

echo "--- BEFORE: rows with null/blank preview_video_url that DO have a final_mv asset ---"
PGPASSWORD="Au#20016" psql -h 127.0.0.1 -U cssstudio -d cssstudio <<'SQL'
SELECT count(*) AS recoverable
  FROM user_works w
  JOIN work_assets a ON a.work_id = w.id AND a.asset_type = 'final_mv'
 WHERE COALESCE(NULLIF(TRIM(w.preview_video_url), ''), '') = ''
    OR w.preview_video_url IS NULL;

SELECT id, title, source_run_id, preview_video_url
  FROM user_works
 WHERE COALESCE(NULLIF(TRIM(preview_video_url), ''), '') = ''
    OR preview_video_url IS NULL
 ORDER BY created_at DESC
 LIMIT 10;
SQL

echo
echo "--- backfilling user_works.preview_video_url from work_assets.final_mv ---"
PGPASSWORD="Au#20016" psql -h 127.0.0.1 -U cssstudio -d cssstudio <<'SQL'
UPDATE user_works w
   SET preview_video_url = a.url
  FROM work_assets a
 WHERE a.work_id = w.id
   AND a.asset_type = 'final_mv'
   AND COALESCE(NULLIF(TRIM(a.url), ''), '') <> ''
   AND (COALESCE(NULLIF(TRIM(w.preview_video_url), ''), '') = ''
        OR w.preview_video_url IS NULL);
SQL

echo
echo "--- AFTER: how many still missing playable URL ---"
PGPASSWORD="Au#20016" psql -h 127.0.0.1 -U cssstudio -d cssstudio <<'SQL'
SELECT count(*) AS still_missing
  FROM user_works
 WHERE COALESCE(NULLIF(TRIM(preview_video_url), ''), '') = ''
    OR preview_video_url IS NULL;
SQL

echo
echo "--- secondary backfill: scan disk for /artifacts/mv/mv_*.mp4 and link by timestamp ---"
# For works whose source_run_id encodes a millisecond timestamp like
# `mv-1777520698181`, the on-disk artifact is /srv/cssos/current/artifacts/mv/mv_<ts>.mp4
# (also exposed at /artifacts/mv/mv_<ts>.mp4). Best-effort link.
PGPASSWORD="Au#20016" psql -h 127.0.0.1 -U cssstudio -d cssstudio <<'SQL'
WITH disk_artifacts AS (
  -- We can't ls from inside SQL; instead match on source_run_id pattern.
  SELECT id, source_run_id,
         regexp_replace(source_run_id, '^mv[-_]', '') AS ts
    FROM user_works
   WHERE source_run_id ~ '^mv[-_]\d{10,}$'
     AND (COALESCE(NULLIF(TRIM(preview_video_url), ''), '') = ''
          OR preview_video_url IS NULL)
)
SELECT count(*) AS by_run_id_match FROM disk_artifacts;
SQL

# For the disk-match case we need to verify each file actually exists,
# then UPDATE user_works AND INSERT into work_assets. Loop in shell:
echo
echo "--- per-row disk verification + asset link (this can take a moment) ---"
PGPASSWORD="Au#20016" psql -h 127.0.0.1 -U cssstudio -d cssstudio -At -F$'\t' <<'SQL' | while IFS=$'\t' read -r work_id ts; do
SELECT id, regexp_replace(source_run_id, '^mv[-_]', '')
  FROM user_works
 WHERE source_run_id ~ '^mv[-_]\d{10,}$'
   AND (COALESCE(NULLIF(TRIM(preview_video_url), ''), '') = ''
        OR preview_video_url IS NULL);
SQL
  candidate="/srv/cssos/current/artifacts/mv/mv_${ts}.mp4"
  if [ -f "$candidate" ]; then
    url="/artifacts/mv/mv_${ts}.mp4"
    echo "  link work=$work_id → $url"
    PGPASSWORD="Au#20016" psql -h 127.0.0.1 -U cssstudio -d cssstudio -q <<EOSQL
UPDATE user_works SET preview_video_url = '$url' WHERE id = '$work_id';
INSERT INTO work_assets (work_id, asset_type, url, meta)
VALUES ('$work_id', 'final_mv', '$url',
        '{"kind":"backfilled_214","source":"disk_match"}'::jsonb)
ON CONFLICT (work_id, asset_type) DO NOTHING;
EOSQL
  fi
done

echo
echo "--- final tally ---"
PGPASSWORD="Au#20016" psql -h 127.0.0.1 -U cssstudio -d cssstudio <<'SQL'
SELECT
  count(*) FILTER (WHERE preview_video_url IS NOT NULL AND preview_video_url <> '') AS playable,
  count(*) FILTER (WHERE preview_video_url IS NULL OR preview_video_url = '') AS not_playable,
  count(*) AS total
FROM user_works;
SQL
echo
echo "Done. Audio tracks (kie.ai tempfile URLs) cannot be backfilled — those"
echo "URLs expired. Old works will play the final mp4 (which has audio muxed in)"
echo "but the standalone Music tab will be empty until the user generates a new run."
