-- CSSOS_WAVE_1970 20260826 — Jing:「真视频 MV 必须排在最先, 优先播放。」
--
-- 为什么要一个显式标记, 而不是靠判据猜:
-- 库里很多作品都有 preview_video_url, 但那多半是 5 秒的 Seedance 短片垫在整首歌下面
-- (画音分层), 不是"真视频 MV"。真视频 MV 的定义是【视频覆盖整首歌】。
-- 想靠"视频时长 ≥ 音频 80%"来判, 需要两个时长都在库里 —— 而实测 871/1680 首连
-- duration_secs 都是空的, 猜出来必然误判。合成完整视频轨时打一个标, 最诚实也最省事。
ALTER TABLE user_works ADD COLUMN IF NOT EXISTS is_real_video_mv boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS user_works_real_video_idx
  ON user_works (is_real_video_mv, created_at DESC)
  WHERE is_real_video_mv = true;
