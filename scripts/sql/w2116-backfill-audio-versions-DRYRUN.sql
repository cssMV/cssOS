\pset border 2
-- W2116 回填干跑 —— 只读, 不写任何东西。
-- 目的: 把【历史上从没进过 work_media_versions 的音频】补登记成版本行。
-- 这是【只 INSERT 的账本登记】: 不动任何现有行, 不改任何 URL, 不影响播放。

CREATE TEMP VIEW cand AS
-- A. 语言轨的主音轨
SELECT lt.work_id, lt.lang, lt.audio_url AS url, lt.duration_secs AS dur,
       lt.subtitle_url AS sub, 'track.audio_url' AS src
  FROM work_language_tracks lt
 WHERE lt.audio_url IS NOT NULL AND lt.audio_url LIKE 'http%'
UNION ALL
-- B. 语言轨的备用音轨(♪2) —— 这才是大头, 历史上几乎从没登记过
SELECT lt.work_id, lt.lang, lt.alt_audio_url, lt.alt_duration_secs,
       NULL, 'track.alt_audio_url'
  FROM work_language_tracks lt
 WHERE lt.alt_audio_url IS NOT NULL AND lt.alt_audio_url LIKE 'http%'
UNION ALL
-- C. 没有语言轨的作品(MV 管线创作): work_assets 的两个平格
SELECT wa.work_id, NULL, wa.url, NULL, NULL, 'asset.' || wa.asset_type
  FROM work_assets wa
 WHERE wa.asset_type IN ('audio_track_1','audio_track_2')
   AND wa.url IS NOT NULL AND wa.url LIKE 'http%'
   AND NOT EXISTS (SELECT 1 FROM work_language_tracks lt WHERE lt.work_id = wa.work_id);

-- 已经在版本表里的一律不算(键必须与触发器一致: work_id + kind + COALESCE(lang,'') + url)
CREATE TEMP VIEW todo AS
SELECT DISTINCT ON (c.work_id, COALESCE(c.lang,''), c.url)
       c.work_id, c.lang, c.url, c.dur, c.sub, c.src
  FROM cand c
 WHERE NOT EXISTS (
   SELECT 1 FROM work_media_versions v
    WHERE v.work_id = c.work_id AND v.kind = 'audio'
      AND COALESCE(v.lang,'') = COALESCE(c.lang,'') AND v.url = c.url)
 ORDER BY c.work_id, COALESCE(c.lang,''), c.url, c.src;

SELECT '=== 候选总数(去重前) ===' AS x;
SELECT count(*) FROM cand;

SELECT '=== 真正要写的(去掉已登记 + 批内去重) ===' AS x;
SELECT src, count(*) AS n FROM todo GROUP BY 1 ORDER BY 2 DESC;
SELECT count(*) AS total_to_insert, count(DISTINCT work_id) AS works FROM todo;

SELECT '=== 抽样 8 条 ===' AS x;
SELECT left(work_id::text,8) AS work, COALESCE(lang,'(null)') AS lang,
       right(url,26) AS url_tail, src FROM todo ORDER BY random() LIMIT 8;

SELECT '=== 安全自检 1: 批内有没有同 (work,lang,url) 重复(触发器会炸) ===' AS x;
SELECT count(*) AS dup_groups FROM (
  SELECT work_id, COALESCE(lang,''), url FROM todo
   GROUP BY 1,2,3 HAVING count(*) > 1) z;

SELECT '=== 安全自检 2: 有没有和现存行撞 (应为 0) ===' AS x;
SELECT count(*) AS collide FROM todo t JOIN work_media_versions v
    ON v.work_id=t.work_id AND v.kind='audio'
   AND COALESCE(v.lang,'')=COALESCE(t.lang,'') AND v.url=t.url;

SELECT '=== 安全自检 3: 写完之后每条轨会有几版(抽最多的 5 个) ===' AS x;
SELECT left(work_id::text,8) AS work, COALESCE(lang,'(null)') AS lang, count(*) AS new_rows
  FROM todo GROUP BY 1,2 ORDER BY 3 DESC LIMIT 5;
