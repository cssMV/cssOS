-- CSSOS_WAVE_584 20260531 — Jing「多声线」: 同一作品、同一语言, 可有多条不同【声线】的演唱轨。
-- (多语言 = 不同 lang; 多声线 = 同 lang 不同 voice。旋律不变, 换音色, 调性自动适配新声线音域。)
--
-- 现有唯一约束 (work_id, lang) 限制了一个语言只能一条轨 → 多声线会撞约束。
-- 加 voice 列(默认 'auto' = 原始声线), 把唯一约束扩成 (work_id, lang, voice)。

ALTER TABLE work_language_tracks
  ADD COLUMN IF NOT EXISTS voice TEXT NOT NULL DEFAULT 'auto';

-- 旧轨补 'auto'(原始声线), 已由 DEFAULT 保证; 显式 backfill 以防 NULL 历史行。
UPDATE work_language_tracks SET voice = 'auto' WHERE voice IS NULL;

-- 替换唯一约束: (work_id, lang) → (work_id, lang, voice)。
-- CSSOS_WAVE_587 — 旧唯一可能以【约束】或【索引】两种形态存在(不同历史迁移路径); 两种都清,
-- 否则多声线 INSERT 撞 (work_id, lang) 唯一 → 500(W587 live 上就踩了这个坑)。
ALTER TABLE work_language_tracks DROP CONSTRAINT IF EXISTS work_language_tracks_work_lang_idx;
ALTER TABLE work_language_tracks DROP CONSTRAINT IF EXISTS work_language_tracks_work_id_lang_key;
DROP INDEX IF EXISTS work_language_tracks_work_lang_idx;
CREATE UNIQUE INDEX IF NOT EXISTS work_language_tracks_work_lang_voice_idx
  ON work_language_tracks (work_id, lang, voice);

-- 便于按声线查询。
CREATE INDEX IF NOT EXISTS work_language_tracks_voice_idx
  ON work_language_tracks (voice) WHERE status = 'ready';
