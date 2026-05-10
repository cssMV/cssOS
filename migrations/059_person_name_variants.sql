-- CSSOS_WAVE_110E 20260510 — Jing
-- Wikidata-style multi-language name variants for person profiles.
-- Hero card displays all populated variants under the locale-primary
-- name; backfill from Wikidata Q-IDs (one-time task) or from the LLM
-- when generating ad-hoc persons.
--
-- Shape: { "en":"Confucius", "zh":"孔子", "ja":"孔子", "ko":"공자",
--          "ru":"Конфуций", "de":"Konfuzius", "es":"Confucio", ... }
ALTER TABLE person_profiles
  ADD COLUMN IF NOT EXISTS name_variants JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Helpful index for any future "search by alternate name" queries.
CREATE INDEX IF NOT EXISTS person_profiles_name_variants_gin
  ON person_profiles USING GIN (name_variants);
