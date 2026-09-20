\set ON_ERROR_STOP on
\pset border 2
-- W2116 回填(真写) —— Jing 2026-09-19 明确同意。
--
-- 性质: 【只 INSERT 的账本登记】。不 UPDATE 任何现有行, 不改任何 URL,
--       不动 is_current, 不影响播放。目的是让每一份历史音频【在版本表里有自己的一行】,
--       这样它就再也不会像 W2061 那 17 首一样悄无声息地消失。
--
-- label 一律留 NULL: 这些是账本条目, 不是给用户看的版本名。
--   读取侧(loadWorkTakes)对已属于某条轨的 URL 会自动去重 → 屏幕上一个像素都不动。
-- is_current 一律 false: 避开 wmv_one_current 这个部分唯一索引, 绝不抢现有的"当前版"。

BEGIN;

CREATE TEMP VIEW cand AS
SELECT lt.work_id, lt.lang, lt.audio_url AS url, lt.duration_secs AS dur,
       lt.subtitle_url AS sub, 'track.audio_url' AS src, 1 AS ord
  FROM work_language_tracks lt
 WHERE lt.audio_url IS NOT NULL AND lt.audio_url LIKE 'http%'
UNION ALL
SELECT lt.work_id, lt.lang, lt.alt_audio_url, lt.alt_duration_secs,
       NULL, 'track.alt_audio_url', 2
  FROM work_language_tracks lt
 WHERE lt.alt_audio_url IS NOT NULL AND lt.alt_audio_url LIKE 'http%'
UNION ALL
SELECT wa.work_id, NULL, wa.url, NULL, NULL, 'asset.' || wa.asset_type,
       CASE WHEN wa.asset_type = 'audio_track_1' THEN 1 ELSE 2 END
  FROM work_assets wa
 WHERE wa.asset_type IN ('audio_track_1','audio_track_2')
   AND wa.url IS NOT NULL AND wa.url LIKE 'http%'
   AND NOT EXISTS (SELECT 1 FROM work_language_tracks lt WHERE lt.work_id = wa.work_id);

CREATE TEMP VIEW todo AS
SELECT DISTINCT ON (c.work_id, COALESCE(c.lang,''), c.url)
       c.work_id, c.lang, c.url, c.dur, c.sub, c.src, c.ord
  FROM cand c
 WHERE NOT EXISTS (
   SELECT 1 FROM work_media_versions v
    WHERE v.work_id = c.work_id AND v.kind = 'audio'
      AND COALESCE(v.lang,'') = COALESCE(c.lang,'') AND v.url = c.url)
 ORDER BY c.work_id, COALESCE(c.lang,''), c.url, c.ord;

-- 触发器是 RAISE EXCEPTION 不是静默跳过, 所以【批内也必须无重复】。先卡死这条。
DO $$
DECLARE d int;
BEGIN
  SELECT count(*) INTO d FROM (
    SELECT work_id, COALESCE(lang,''), url FROM todo GROUP BY 1,2,3 HAVING count(*)>1) z;
  IF d > 0 THEN RAISE EXCEPTION '批内有 % 组重复, 会触发守卫 —— 中止', d; END IF;
END $$;

SELECT count(*) AS will_insert FROM todo;

INSERT INTO work_media_versions
  (work_id, kind, lang, version_no, label, url, subtitle_url, duration_secs, is_current)
SELECT t.work_id, 'audio', t.lang,
       COALESCE((SELECT max(v.version_no) FROM work_media_versions v
                  WHERE v.work_id = t.work_id AND v.kind = 'audio'
                    AND COALESCE(v.lang,'') = COALESCE(t.lang,'')), 0)
       + row_number() OVER (PARTITION BY t.work_id, COALESCE(t.lang,'')
                            ORDER BY t.ord, t.url),
       NULL, t.url, t.sub, t.dur, false
  FROM todo t;

-- 写完自检: 应该一条都不剩
SELECT count(*) AS still_missing FROM todo t
 WHERE NOT EXISTS (
   SELECT 1 FROM work_media_versions v
    WHERE v.work_id=t.work_id AND v.kind='audio'
      AND COALESCE(v.lang,'')=COALESCE(t.lang,'') AND v.url=t.url);

COMMIT;

SELECT '=== 写完之后 ===' AS x;
SELECT count(*) AS audio_rows_total FROM work_media_versions WHERE kind='audio';
SELECT count(*) AS rows_just_written FROM work_media_versions
 WHERE kind='audio' AND label IS NULL AND is_current = false
   AND created_at > now() - interval '5 minutes';
