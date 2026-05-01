-- Mirror the /cssapi/v1/mv self CTE for admin user
WITH playable AS (
  SELECT w.id, w.title, w.created_at,
         COALESCE(w.root_work_id, w.id) AS root_id,
         COALESCE(w.sequence_index, 0) AS sequence_index,
         fm.url AS final_mv_url,
         a1.url AS audio_track_1_url,
         a2.url AS audio_track_2_url,
         COALESCE((fm.meta->>'take_index')::int, NULL) AS take_index
    FROM user_works w
    LEFT JOIN work_assets fm ON fm.work_id = w.id AND fm.asset_type = 'final_mv'
    LEFT JOIN work_assets a1 ON a1.work_id = w.id AND a1.asset_type = 'audio_track_1'
    LEFT JOIN work_assets a2 ON a2.work_id = w.id AND a2.asset_type = 'audio_track_2'
   WHERE w.user_id = 'ff6d32ab-fc93-4971-9c28-9b9f8c195cbb'
     AND fm.url IS NOT NULL
     AND COALESCE((fm.meta->>'take_index')::int, 1) <> 2
),
roots AS (
  SELECT DISTINCT pl.root_id AS id, root.created_at
    FROM playable pl
    JOIN user_works root ON root.id = pl.root_id
   ORDER BY root.created_at DESC
   LIMIT 8
)
SELECT pl.id, pl.title, pl.take_index,
       LEFT(pl.final_mv_url, 50) AS final_mv,
       LEFT(pl.audio_track_1_url, 50) AS a1,
       LEFT(pl.audio_track_2_url, 50) AS a2
  FROM playable pl
  JOIN roots ON roots.id = pl.root_id
 ORDER BY roots.created_at DESC, pl.sequence_index ASC, pl.created_at ASC;
