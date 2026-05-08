-- CSSOS_PERSON_MV_WAVE54_55 20260508 — Jing
-- Wave 54: engine usage observability — relies on rolling in-memory window
-- (engineUsageWindow). No DB schema needed for live counters; existing
-- usage_events still drives historical/cost views.
--
-- Wave 55: content rating (PG / 13+ / 18+) on persons + MVs + works,
-- plus user birth_year for age gating. Both additive.

ALTER TABLE person_profiles
  ADD COLUMN IF NOT EXISTS content_rating TEXT NOT NULL DEFAULT 'PG';
ALTER TABLE person_mvs
  ADD COLUMN IF NOT EXISTS content_rating TEXT NOT NULL DEFAULT 'PG';
ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS content_rating TEXT NOT NULL DEFAULT 'PG';
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS birth_year INTEGER;

CREATE INDEX IF NOT EXISTS person_profiles_rating_idx
  ON person_profiles (content_rating);
CREATE INDEX IF NOT EXISTS person_mvs_rating_idx
  ON person_mvs (content_rating);
