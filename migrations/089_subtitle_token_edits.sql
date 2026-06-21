-- CSSOS_WAVE_1044 20260620 — Jing「波形逐字精修 v2 · 加/删 token」: 每作品一个非破坏性
-- 字幕 token 增删表 { added:[{id,text,t,line,emo}], deleted:[tokenKey,...] }。
--   added  = 用户手动加的字/拟声词(如《Jerusalem》间奏的"咿呀"), t=起始秒, line=挂到哪一句(可空=独立),
--            id 形如 "u<ms>" 稳定唯一; emo=情绪(可空)。
--   deleted = 要隐藏的原始 token 的 key(= 该字原始起始毫秒字符串), 与逐字偏移同一套 key。
-- 与 subtitle_offset_ms / line_offsets / token_offsets 叠加, 原字幕 JSON 永不改(可随时还原)。
ALTER TABLE user_works ADD COLUMN IF NOT EXISTS subtitle_token_edits jsonb NOT NULL DEFAULT '{"added":[],"deleted":[]}'::jsonb;
