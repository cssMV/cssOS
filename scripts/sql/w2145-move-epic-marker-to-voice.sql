-- W2145 · 把「epic 之前的那一版」的身份标记从 lang 挪到 voice
--
-- 旧形: lang='orig-pre-epic', voice='auto'      ← 版本被塞进了语言那一格
-- 新形: lang=<该作品的真语言>,  voice='pre-epic' ← 语言归语言, 版本归声线
--
-- 真语言取自【同作品的默认轨】: epic 轨唱的是同一份词、同一门语言。
-- 实测 63/63 条都有这样一条默认轨, 且它的 lang 全是真语言(无占位符) —— 不需要猜。
--
-- 一行不删、一个字节不动, 只改两列; 原值存进 w2145_track_marker_backup, 回滚一条 UPDATE。
-- 唯一键 (work_id, lang, voice) 实测零冲突(无作品有两条 pre-epic, 无既存 voice='pre-epic')。

BEGIN;

CREATE TABLE IF NOT EXISTS w2145_track_marker_backup (
  track_id   bigint PRIMARY KEY,
  work_id    uuid   NOT NULL,
  old_lang   text   NOT NULL,
  old_voice  text   NOT NULL,
  new_lang   text   NOT NULL,
  backed_up  timestamptz NOT NULL DEFAULT now()
);

WITH tgt AS (
  SELECT pe.id, pe.work_id, pe.lang AS old_lang, pe.voice AS old_voice, d.lang AS new_lang
    FROM work_language_tracks pe
    JOIN LATERAL (
      SELECT t.lang FROM work_language_tracks t
       WHERE t.work_id = pe.work_id AND t.is_default = true AND t.lang <> 'orig-pre-epic'
       LIMIT 1) d ON true
   WHERE pe.lang = 'orig-pre-epic'
)
INSERT INTO w2145_track_marker_backup (track_id, work_id, old_lang, old_voice, new_lang)
SELECT id, work_id, old_lang, old_voice, new_lang FROM tgt
ON CONFLICT (track_id) DO NOTHING;

UPDATE work_language_tracks t
   SET lang = b.new_lang, voice = 'pre-epic', updated_at = now()
  FROM w2145_track_marker_backup b
 WHERE t.id = b.track_id AND t.lang = 'orig-pre-epic';

-- 默认【干跑】: 文件里没有 COMMIT, psql 跑完断开即回滚, 可放心先看数字。
-- 正式执行:  (cat 本文件; echo "COMMIT;") | psql ...
-- 回滚:      UPDATE work_language_tracks t SET lang=b.old_lang, voice=b.old_voice
--              FROM w2145_track_marker_backup b WHERE t.id=b.track_id;
