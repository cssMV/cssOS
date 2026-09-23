-- W2146 · 把被 LLM 元话语(拒绝/点评)污染的 lyrics 列恢复成真歌词
--
-- 成因: 某个更早的生成把伪键 'orig-pre-epic' 当成一门语言传给了模型, 模型回的是
-- 「这不是一门真语言」「你分享的这首歌看起来已经是 Zapotec 了」这类【对话】,
-- 被原样存进了 lyrics 列。W2143 照着它对齐字幕, 生成的字幕就是那段对话(已撤销)。
--
-- 不需要任何生成: 真歌词全都在库里。取源按证据强弱:
--   ① 同作品【干净的默认轨】的 lyrics —— epic 唱的本来就是同一份词
--   ② 退而取 user_works.lyrics_preview —— 全库实测干净(4 条误报已人眼排除:
--      真英文歌词里的 "a tear I cannot hide" 命中了过宽的判据)
--
-- 判据定稿 = 只抓【元话语开场白】。收紧时曾把 "I notice" 去掉, 结果两条真脏的
-- (Valhǫll / 祇園精舎)当场漏出去 —— 所以它留着; "I cannot" / "Let me know"
-- 去掉, 因为真歌词会有。
--
-- 旧值全进 w2146_track_lyrics_backup, 回滚一条 UPDATE。

BEGIN;

CREATE TABLE IF NOT EXISTS w2146_track_lyrics_backup (
  track_id   bigint PRIMARY KEY,
  work_id    uuid NOT NULL,
  old_lyrics text,
  new_lyrics text NOT NULL,
  src        text NOT NULL,
  backed_up  timestamptz NOT NULL DEFAULT now()
);

WITH pat AS (SELECT '(you.?ve shared|I appreciate you|I need to clarify|not a real language|appears to (already )?be written|I.d be happy to|Here.s (a|the) (translation|breakdown)|As an AI|I notice (that|the))'::text p),
bad AS (SELECT t.id, t.work_id FROM work_language_tracks t, pat WHERE t.lyrics ~* pat.p),
src AS (
  SELECT b.id, b.work_id,
         COALESCE(sib.lyrics, w.lyrics_preview) AS new_lyrics,
         CASE WHEN sib.lyrics IS NOT NULL THEN 'clean_sibling_track' ELSE 'work_lyrics_preview' END AS src
    FROM bad b
    JOIN user_works w ON w.id = b.work_id
    LEFT JOIN LATERAL (
      SELECT s.lyrics FROM work_language_tracks s, pat
       WHERE s.work_id = b.work_id AND s.id <> b.id
         AND COALESCE(s.lyrics,'') <> '' AND s.lyrics !~* pat.p
       ORDER BY s.is_default DESC, s.track_order ASC LIMIT 1) sib ON true
)
INSERT INTO w2146_track_lyrics_backup (track_id, work_id, old_lyrics, new_lyrics, src)
SELECT s.id, s.work_id, t.lyrics, s.new_lyrics, s.src
  FROM src s JOIN work_language_tracks t ON t.id = s.id
 WHERE COALESCE(s.new_lyrics,'') <> ''        -- 取不到干净源就不动它, 宁可留着也不写空
ON CONFLICT (track_id) DO NOTHING;

UPDATE work_language_tracks t
   SET lyrics = b.new_lyrics, updated_at = now()
  FROM w2146_track_lyrics_backup b
 WHERE t.id = b.track_id;

-- 默认【干跑】: 文件没有 COMMIT, psql 跑完断开即回滚。
-- 正式: (cat 本文件; echo "COMMIT;") | psql ...
-- 回滚: UPDATE work_language_tracks t SET lyrics=b.old_lyrics
--         FROM w2146_track_lyrics_backup b WHERE t.id=b.track_id;
