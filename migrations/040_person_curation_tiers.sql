-- CSSOS_PERSON_MV_WAVE58 20260508 — Jing
-- Wave 58: S/A/B curation tiers + bulk-gen telemetry.
--   S = global consensus figures (pre-generate sample MV)
--   A = civilization representatives (no pre-built MV)
--   B = domain representatives (no pre-built MV, no portrait)
-- Existing curated 22 seeds are S-tier, hand-authored (auto_generated=false).

ALTER TABLE person_profiles
  ADD COLUMN IF NOT EXISTS curation_tier   TEXT NOT NULL DEFAULT 'S';
ALTER TABLE person_profiles
  ADD COLUMN IF NOT EXISTS pageviews_monthly INTEGER;
ALTER TABLE person_profiles
  ADD COLUMN IF NOT EXISTS academic_citations INTEGER;
ALTER TABLE person_profiles
  ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS person_profiles_tier_idx
  ON person_profiles (curation_tier, influence_score DESC);
