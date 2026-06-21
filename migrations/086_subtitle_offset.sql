-- CSSOS_WAVE_994 20260618 — Jing「字幕整体偏移微调(第一期)」: 每作品一个全局字幕
-- 时间偏移(毫秒, 可正可负), 播放时整体平移所有字幕 cue, 让字幕真正对齐歌声。
-- 非破坏性: 不改 subtitle-take1.json, 只在播放层平移。
ALTER TABLE user_works ADD COLUMN IF NOT EXISTS subtitle_offset_ms integer NOT NULL DEFAULT 0;
