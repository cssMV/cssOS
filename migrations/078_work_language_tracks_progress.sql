-- CSSOS_WAVE_433 20260525 — Jing「要真进度: 逐阶段百分比 + 哪种语言 + 1/8 封面 + 完成时长」
-- Per-language render stage + percentage so the watch UI shows GENUINE progress
-- (not a fake 3-state bar). stage ∈ lyrics|music|align|persist|ready|failed.
ALTER TABLE work_language_tracks
  ADD COLUMN IF NOT EXISTS stage        TEXT,
  ADD COLUMN IF NOT EXISTS progress_pct INTEGER;
