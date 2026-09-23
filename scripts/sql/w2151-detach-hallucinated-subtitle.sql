-- W2151 · 奥古斯都(纯器乐)的幻觉字幕摘掉指针
--
-- 字幕全文是 "Thank you. Thank you." 两行 —— Whisper 在【无人声音频】上的经典幻觉。
-- 作品是 style='Solemn Orchestra / Ancient Instruments'、30 秒、轨 lyrics 为空:
-- 它本来就没有唱词, 正确状态是【不该有字幕】, 不是把这两行修好。
--
-- 做法是【摘指针, 不删字节】: 文件原样留在 R2(它是 ASR 当时输出的记录),
-- 只把 user_works.subtitle_take1_json_url 置空, 播放端就取不到字幕了。
-- 该作品的轨没有自己的 subtitle_url, 走的正是这个作品级回退。
-- 回滚一条 UPDATE, 原值在 w2151_subtitle_pointer_backup。
--
-- ⚠ 同类全库共 40 个(全部 published), 另有 39 个作品的 lyrics_preview 被同一段幻觉
--   污染(值就是 "Thank you.\nThank you.")。本文件【只处理奥古斯都这一个】——
--   批量要先问 Jing。

BEGIN;

CREATE TABLE IF NOT EXISTS w2151_subtitle_pointer_backup (
  work_id      uuid PRIMARY KEY,
  old_url      text NOT NULL,
  old_lyrics   text,
  backed_up    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO w2151_subtitle_pointer_backup (work_id, old_url, old_lyrics)
SELECT id, subtitle_take1_json_url, lyrics_preview
  FROM user_works
 WHERE left(id::text,8) = '4b837997' AND coalesce(subtitle_take1_json_url,'') <> ''
ON CONFLICT (work_id) DO NOTHING;

UPDATE user_works w
   SET subtitle_take1_json_url = NULL
  FROM w2151_subtitle_pointer_backup b
 WHERE w.id = b.work_id;

-- 默认干跑(无 COMMIT)。正式: (cat 本文件; echo "COMMIT;") | psql ...
-- 回滚: UPDATE user_works w SET subtitle_take1_json_url=b.old_url
--         FROM w2151_subtitle_pointer_backup b WHERE w.id=b.work_id;
