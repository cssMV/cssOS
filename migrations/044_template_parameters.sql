-- CSSOS_PERSON_MV_WAVE73 20260508 — Jing
-- Parameterized templates. Adds optional parameters[] schema to templates so
-- callers can substitute {{key}} placeholders inside seed.prompt/style/etc.
-- Each entry: {key, label_zh, label_en, type:'text'|'select'|'number',
--             default?: any, options?: string[]}
ALTER TABLE person_mv_templates
  ADD COLUMN IF NOT EXISTS parameters JSONB NOT NULL DEFAULT '[]'::jsonb;
