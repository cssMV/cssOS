-- W2153 · Jerusalem(5e77e03a): 摘掉字幕指针, 【字幕文件原样保留】
--
-- 那 43 行英文不是串了别人的歌 —— 它是【这首作品自己旧音频的 ASR 转写】:
--   · 字幕 42 行拼起来与 user_works.lyrics_preview 去空白后【逐字相等】(1283 = 1283)
--   · 断行全在句中("…Ancient tales that hold / me fast Each drop of rain…"),
--     按约 50 字切 —— 机器转写的特征, 作词不会这么断
--   → 链路是: 音频 → ASR → 同时写进字幕文件和 lyrics_preview(与 W2152 的幻觉回写同一条路)
--
-- 那份旧音频【已经永久丢失】(2026-08-24 批量重生成覆盖 17 首的那次, 清单里就有 Jerusalem ×2):
--   · 5e77e03a 字幕分析 2026-06-14, 转写 = "In the stillness, shadows play…"
--   · f49ed33c 字幕分析 2026-06-13, 转写 = "Jerusalem, holy and bright…"
--   两份完全不同的转写, 今天却指着【同一份音频字节】(内容哈希 aud-a04ebb58ce…, 都 193s)。
--   即 5e77e03a 现在挂的是 f49ed33c 的音频; 它自己的轨 ja/auto 是 failed 且无音频。
--
-- 于是这首正在显示一份与自己音频对不上的字幕 —— 唱 Jerusalem, 字幕写赛博武士。
-- 错的字幕比没有字幕更糟(平台既定原则), 所以摘。
--
-- 但【文件不删】: 它是那首丢失音频仅存的痕迹。只摘指针, 回滚一条 UPDATE。
--
-- 本波不动 user_works.lyrics_preview —— Jing 的指令是「只摘指针」。那一列同样是这份
-- 转写(也就是同一份痕迹), 但它对用户显示为"歌词", 要不要清另行请示。

BEGIN;

CREATE TABLE IF NOT EXISTS w2153_subtitle_pointer_backup (
  work_id    uuid PRIMARY KEY,
  old_url    text NOT NULL,
  backed_up  timestamptz NOT NULL DEFAULT now()
);

INSERT INTO w2153_subtitle_pointer_backup (work_id, old_url)
SELECT id, subtitle_take1_json_url FROM user_works
 WHERE left(id::text,8) = '5e77e03a' AND coalesce(subtitle_take1_json_url,'') <> ''
ON CONFLICT (work_id) DO NOTHING;

UPDATE user_works w SET subtitle_take1_json_url = NULL
  FROM w2153_subtitle_pointer_backup b WHERE w.id = b.work_id;

-- 默认干跑(文件无 COMMIT)。正式: (cat 本文件; echo "COMMIT;") | psql ...
--   ⚠ 本文件必须以换行结尾, 否则 COMMIT 会被接到注释后面整条失效(W2152 踩过)。
-- 回滚: UPDATE user_works w SET subtitle_take1_json_url=b.old_url
--         FROM w2153_subtitle_pointer_backup b WHERE w.id=b.work_id;
