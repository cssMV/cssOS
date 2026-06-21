-- CSSOS_WAVE_995 20260618 — Jing「逐句字幕微调(第二期a)」: 每作品一个 {lineIndex: ms}
-- 偏移表, 播放时把【那一句】的所有 token 单独前后平移, 让每句真正咬合歌声。
-- 非破坏性(不改 subtitle-take1.json, 播放层平移)。配合 subtitle_offset_ms(整体)叠加。
ALTER TABLE user_works ADD COLUMN IF NOT EXISTS subtitle_line_offsets jsonb NOT NULL DEFAULT '{}'::jsonb;
