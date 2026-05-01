-- How many of admin's works qualify for the /cssapi/v1/mv self queue?
SELECT u.email,
       COUNT(*) AS total_works,
       COUNT(fm.url) AS with_final_mv_asset,
       COUNT(NULLIF(TRIM(w.preview_video_url), '')) AS with_preview_video,
       COUNT(*) FILTER (
         WHERE fm.url IS NOT NULL
           AND COALESCE((fm.meta->>'take_index')::int, 1) <> 2
       ) AS qualifies_current,
       COUNT(*) FILTER (
         WHERE COALESCE(fm.url, NULLIF(TRIM(w.preview_video_url), '')) IS NOT NULL
           AND COALESCE((fm.meta->>'take_index')::int, 1) <> 2
       ) AS qualifies_relaxed
  FROM user_works w
  JOIN users u ON u.id = w.user_id
  LEFT JOIN work_assets fm ON fm.work_id = w.id AND fm.asset_type = 'final_mv'
 WHERE u.email = 'admin@cssstudio.app'
   AND w.parent_work_id IS NULL
 GROUP BY u.email;
