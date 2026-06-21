-- CSSOS_WAVE_996 20260618 — Jing「逐字波形精修(第二期b)」: 每作品一个 {tokenKey: ms}
-- 逐字偏移表(key = 该字的原始起始毫秒, 稳定), 波形编辑器里把某个字拖到歌声咬字处,
-- 播放层单独平移那个字。非破坏性, 与整体/逐句偏移叠加。
ALTER TABLE user_works ADD COLUMN IF NOT EXISTS subtitle_token_offsets jsonb NOT NULL DEFAULT '{}'::jsonb;
