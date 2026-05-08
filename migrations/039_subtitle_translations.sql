-- CSSOS_PERSON_MV_WAVE53 20260508 — Jing
-- Cinema-mode bilingual subtitle translation cache.
CREATE TABLE IF NOT EXISTS subtitle_translations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL,
  source_lang TEXT NOT NULL,
  target_lang TEXT NOT NULL,
  srt_url TEXT,
  srt_inline TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (work_id, target_lang)
);
CREATE INDEX IF NOT EXISTS subtitle_translations_work_idx ON subtitle_translations (work_id);
