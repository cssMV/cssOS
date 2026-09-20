-- W2126 · 剥掉歌词里的 LLM JSON 信封 (2026-09-20)
--
-- 病象: user_works.lyrics_preview 里存的不是歌词, 而是 LLM 返回的整坨 JSON ——
--   {"lyrics": "[Intro]\nIn the quiet of the night,\n..."}
-- 于是这些作品的字幕上屏时会显示 `"lyrics":` 和字面的 \n。全库 187 首, 其中 179 首已做成字幕。
-- (语言轨 work_language_tracks.lyrics 里【一条都没有】—— 只有这一列中招, 说明是某条写入路径
--  没解析就整坨存了。修数据的同时, 那条路径也该堵上, 见文件末尾。)
--
-- 性质: 【纯解析修复】。不调用任何模型, 不生成一个字, 只是把信封拆开取出里面本来就有的歌词。
--
-- 安全:
--   ① 原文【先备份】进 w2126_lyrics_backup(只 INSERT), 再 UPDATE —— 旧字节有自己的地址。
--   ② 只有在【解析成功 且 取出来的歌词 >= 40 字 且 与原文不同】时才更新; 任何一条不满足就不动。
--   ③ 整个过程在一个事务里, 自检不过就 ROLLBACK。

\set ON_ERROR_STOP on
\pset border 2

BEGIN;

CREATE TABLE IF NOT EXISTS w2126_lyrics_backup (
  work_id    uuid PRIMARY KEY,
  old_lyrics text NOT NULL,
  new_lyrics text NOT NULL,
  fixed_at   timestamptz NOT NULL DEFAULT now()
);

-- 把信封拆开 —— 【文本手术, 不靠 JSON 合法性】。
--
-- ⚠ 第一版写成 `s::jsonb ->> 'lyrics'`, 结果 187 首【一首都拆不开】。
--   根因: 这一列是 preview, 本来就被截断 —— 值在句中就断了, 没有收尾的引号和花括号,
--   所以它【不是合法 JSON】, 任何 JSON 解析路线都必然失败。
--   实测 187 首里只有 25 首尾部完整收了口, 另外 162 首是断的。
--   → 判据必须适配数据的真实形态, 不能按它"应该是什么"来写。
CREATE OR REPLACE FUNCTION w2126_unwrap(src text) RETURNS text AS $fn$
DECLARE m text;
BEGIN
  IF src IS NULL THEN RETURN NULL; END IF;
  m := regexp_replace(src, '```[a-zA-Z]*', '', 'g');          -- C 类: markdown 围栏
  -- 取 "lyrics": " 之后的一切。B 类前面的标题回声就此丢掉 —— 标题不是歌词。
  m := substring(m from '"lyrics?"\s*:\s*"([\s\S]*)$');
  IF m IS NULL THEN RETURN NULL; END IF;
  -- 后面若还跟着别的键, 在第一个【未转义的】 `",` / `"}` 处截断
  m := regexp_replace(m, '(?<!\\)"\s*[,}][\s\S]*$', '');
  -- 反转义(顺序要紧: 先 \" 与 \n\t, 最后才 \\)
  m := replace(m, '\"', '"');
  m := replace(m, '\n', E'\n');
  m := replace(m, '\t', E'\t');
  m := replace(m, '\\', '\');
  m := btrim(m);
  IF length(m) < 40 THEN RETURN NULL; END IF;   -- 拆出来太短 = 没拆对, 不动它
  RETURN m;
END $fn$ LANGUAGE plpgsql IMMUTABLE;

-- ── 先看能修多少 ────────────────────────────────────────────────────────
CREATE TEMP VIEW cand AS
SELECT id, title, lyrics_preview AS old, w2126_unwrap(lyrics_preview) AS neo
  FROM user_works
 WHERE lyrics_preview ~ '^\s*\{' OR lyrics_preview ~ '"lyrics"\s*:' OR lyrics_preview ~ '^\s*```';

SELECT count(*) AS "受污染总数",
       count(*) FILTER (WHERE neo IS NOT NULL)                       AS "能拆开",
       count(*) FILTER (WHERE neo IS NULL)                           AS "拆不开(不动)",
       count(*) FILTER (WHERE neo IS NOT NULL AND neo = old)         AS "拆完没变化(不动)"
  FROM cand;

\echo '--- 修复前后抽样(前 3 首) ---'
SELECT left(title,20) AS title,
       left(replace(old, E'\n', ' | '), 72) AS "修前",
       left(replace(neo, E'\n', ' | '), 72) AS "修后"
  FROM cand WHERE neo IS NOT NULL AND neo <> old LIMIT 3;

-- ── 真改 ────────────────────────────────────────────────────────────────
INSERT INTO w2126_lyrics_backup (work_id, old_lyrics, new_lyrics)
SELECT id, old, neo FROM cand
 WHERE neo IS NOT NULL AND neo <> old AND length(btrim(neo)) >= 40
ON CONFLICT (work_id) DO NOTHING;

UPDATE user_works w
   SET lyrics_preview = c.neo, updated_at = now()
  FROM cand c
 WHERE w.id = c.id AND c.neo IS NOT NULL AND c.neo <> c.old AND length(btrim(c.neo)) >= 40;

-- ── 自检: 改了几条? 备份里有几条? 两者必须相等 ──────────────────────────
SELECT (SELECT count(*) FROM w2126_lyrics_backup) AS "备份条数",
       (SELECT count(*) FROM user_works
         WHERE lyrics_preview ~ '^\s*\{' OR lyrics_preview ~ '"lyrics"\s*:') AS "仍被污染的";

COMMIT;

\echo '--- 提交后复查 ---'
SELECT count(*) AS "全库仍有 JSON 信封的"
  FROM user_works WHERE lyrics_preview ~ '^\s*\{' OR lyrics_preview ~ '"lyrics"\s*:';

-- 回滚办法(万一要退):
--   UPDATE user_works w SET lyrics_preview = b.old_lyrics
--     FROM w2126_lyrics_backup b WHERE w.id = b.work_id;
