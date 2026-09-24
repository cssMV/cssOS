-- W2158 · 让《西部狂野》(bf82f509)安静退场 —— 不删, 不覆盖
--
-- 它播的是【另一首歌】: W2157 对当前音频做自由转写(groq whisper), 结果是英文西部片
-- "Out in the dust where the wild winds cry…", 与《Westworld》(ef5f24e6)的歌词重合 59%,
-- 与《西部狂野》自己的歌词重合 0%。那份音频是 Westworld 的, 西部狂野自己的已永久丢失
-- (2026-08-24 那批)。它自己的 lyrics_preview 还是一串逐字空格的乱码。
--
-- ⚠ 上一轮我按字幕结束时间推测归属, 在这一组【推错了】(西部狂野 238.3s 比 Westworld
--   183.8s 更接近音频 272s, 看起来像西部狂野的)。时长只是弱证据, 真转写一遍才作数。
--
-- 退场用平台自己的状态, 不另造: status ready → draft。
-- 实测公开面 5 处过滤全是 status IN ('ready','published'), 没有一处含 draft,
-- 所以它从公开面消失, 而【行、标题、歌词、一切字节原样都在】, 翻回 ready 立刻回来。
--
-- 同时摘掉 preview_audio_url: 那不是它的音频。留着的话
--   ① 一旦有人翻回 ready, 错的歌立刻重演;
--   ② W2154 那条跨作品共用巡检会永远把它算进 48 组存量里。
-- 摘掉之后共用组数应降到 47, 巡检的"改善锁定"会自动把基线降下来。
--
-- 这首没有任何 work_language_tracks 行(实测 0 条), 所以只需动作品级两列。
-- 回滚一条 UPDATE, 原值在 w2158_retire_backup。

BEGIN;

CREATE TABLE IF NOT EXISTS w2158_retire_backup (
  work_id     uuid PRIMARY KEY,
  old_status  text NOT NULL,
  old_audio   text,
  backed_up   timestamptz NOT NULL DEFAULT now()
);

INSERT INTO w2158_retire_backup (work_id, old_status, old_audio)
SELECT id, status, preview_audio_url FROM user_works
 WHERE left(id::text,8) = 'bf82f509' AND status = 'ready'
ON CONFLICT (work_id) DO NOTHING;

UPDATE user_works w
   SET status = 'draft', preview_audio_url = NULL, updated_at = now()
  FROM w2158_retire_backup b
 WHERE w.id = b.work_id;

-- 默认干跑(文件无 COMMIT)。正式: (cat 本文件; echo "COMMIT;") | psql ...
--   ⚠ 本文件必须以换行结尾, 否则 COMMIT 被接到注释后面整条失效(W2152 踩过)。
-- 回滚: UPDATE user_works w SET status=b.old_status, preview_audio_url=b.old_audio
--         FROM w2158_retire_backup b WHERE w.id=b.work_id;
