-- CSSOS_WAVE_113 20260702 — 数字演员「开口说话」showcase: 自我介绍 + 正派/反派技能展示。
-- 缓存 LLM 台词 + ElevenLabs 语音 URL + 逐字情绪字幕时间轴, 避免每次重算/重花钱。
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS showcase JSONB;
