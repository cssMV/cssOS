\set ON_ERROR_STOP on
\pset border 2

-- W2142 · 处理最后 10 条占位符【重复行】。
--
-- 它们是什么(逐条实测, 不是推断):
--   · lang='orig'(占位符)、voice='auto'、is_default=false、2026-06-04 建
--   · 每条都有【恰好一个同音频的兄弟】, 兄弟是真实语言(ja/zh/en)且建于 06-15 那批
--   · audio_url 是【同一个 URL 字符串】—— 平台内容哈希命名, 同 URL 即同一份字节
--   · 自己没有歌词、没有版本字幕
-- 所以它不是"另一个版本", 是同一份音频的一条陈旧记录。用户在它上面【没有任何可选的东西】。
--
-- 怎么处理(铁律: 不删):
--   行、URL、全部字段【一个字节不动】, 只把 status 从 ready 翻成 superseded。
--   胶囊各处一律只认 status==='ready'(app.mv-language-pill.js:509 等), 于是它安静退场;
--   而它既不是 rendering 也不是 pending, 不会被当成"渲染中"画出假进度条。
--   翻回来只需一条 UPDATE(备份表里有原值)。
--
-- 不碰的:
--   · is_default=true 的(《西部狂野》那条, 没有同音频兄弟) —— 它是那首的唯一轨, 动它会让作品哑掉
--   · orig-pre-epic(旗舰墙按它查)
--   · 任何没有同音频兄弟的行 —— 那种可能真的是独立版本

BEGIN;

CREATE TABLE IF NOT EXISTS w2142_track_status_backup (
  track_id   bigint PRIMARY KEY,
  work_id    uuid NOT NULL,
  old_status text NOT NULL,
  new_status text NOT NULL,
  twin_id    bigint,           -- 同音频的那条真实语言轨
  reason     text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE TEMP VIEW cand AS
SELECT t.id, t.work_id, t.status, t.audio_url,
       (SELECT y.id   FROM work_language_tracks y
         WHERE y.work_id=t.work_id AND y.id<>t.id AND y.audio_url=t.audio_url
           AND y.lang NOT IN ('orig','auto','','orig-pre-epic') LIMIT 1) AS twin_id,
       (SELECT y.lang FROM work_language_tracks y
         WHERE y.work_id=t.work_id AND y.id<>t.id AND y.audio_url=t.audio_url
           AND y.lang NOT IN ('orig','auto','','orig-pre-epic') LIMIT 1) AS twin_lang
  FROM work_language_tracks t
 WHERE t.lang IN ('orig','auto','')
   AND t.status = 'ready'
   AND t.is_default = false
   AND COALESCE(t.audio_url,'') <> '';

\echo '--- 干跑: 命中哪些(必须每条都有 twin) ---'
SELECT left(work_id::text,8) AS work, id AS 轨id, twin_id AS 同音频兄弟, twin_lang AS 兄弟语言
  FROM cand ORDER BY work_id;

SELECT count(*) AS 命中总数,
       count(twin_id) AS "有同音频兄弟(才会改)",
       count(*)-count(twin_id) AS "无兄弟(跳过, 可能是真版本)"
  FROM cand;

\echo '--- 安全自检: 改完之后每个作品是否仍有可播的 ready 轨 ---'
SELECT count(*) AS "会变成没有可播轨的作品数(必须为 0)"
  FROM (
    SELECT c.work_id
      FROM cand c WHERE c.twin_id IS NOT NULL
     GROUP BY c.work_id
    HAVING NOT EXISTS (
      SELECT 1 FROM work_language_tracks z
       WHERE z.work_id = c.work_id AND z.status='ready'
         AND COALESCE(z.audio_url,'')<>''
         AND z.id NOT IN (SELECT id FROM cand WHERE twin_id IS NOT NULL))
  ) x;

\echo '--- 真改 ---'
INSERT INTO w2142_track_status_backup (track_id, work_id, old_status, new_status, twin_id, reason)
SELECT id, work_id, status, 'superseded', twin_id,
       '与 ' || twin_id || '(' || twin_lang || ') 同一个 audio_url; 占位符 lang; 非默认轨; 无歌词无字幕'
  FROM cand WHERE twin_id IS NOT NULL
ON CONFLICT (track_id) DO NOTHING;

UPDATE work_language_tracks t SET status='superseded', updated_at=now()
  FROM cand c WHERE t.id=c.id AND c.twin_id IS NOT NULL;

\echo '--- 自检: 改了几条 = 备份几条 ---'
SELECT (SELECT count(*) FROM w2142_track_status_backup) AS 备份条数,
       (SELECT count(*) FROM work_language_tracks WHERE status='superseded') AS 已标记条数;

\echo '--- 自检: 全库还剩多少占位符 ready 轨 ---'
SELECT count(*) AS 剩余占位符ready轨,
       count(*) FILTER (WHERE is_default) AS "其中是默认轨(不该动的)"
  FROM work_language_tracks WHERE lang IN ('orig','auto','') AND status='ready';

COMMIT;

\echo '--- 提交后复查: 那 10 首的兄弟轨是否照常可播 ---'
SELECT left(b.work_id::text,8) AS work,
       (SELECT z.lang||'/'||z.voice||' '||z.status FROM work_language_tracks z WHERE z.id=b.twin_id) AS 兄弟轨,
       (SELECT count(*) FROM work_language_tracks z
         WHERE z.work_id=b.work_id AND z.status='ready' AND COALESCE(z.audio_url,'')<>'') AS 可播轨数
  FROM w2142_track_status_backup b ORDER BY b.work_id;
