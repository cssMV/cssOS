-- CSSOS_WAVE_114 20260511 — Jing
-- Realm (位面) column on both Civilization Universe tables.
--
--   historical   — real history / real geography (default)
--   mythological — myth / religion / cosmology (Zeus, Sun Wukong,
--                  天庭, Olympus, Asgard, 月宫, 西方极乐)
--   literary     — written fiction's personas & places (Harry Potter,
--                  Sherlock Holmes 221B, Westeros, Middle-earth)
--   folkloric    — folk tales / legends / oral tradition not anchored
--                  to one author (牛郎织女, Robin Hood, Paul Bunyan,
--                  白蛇, 鹊桥)
--
-- Allows cross-realm Dialogue MV (Sun Wukong × 凌霄宝殿,
-- Harry Potter × Hogwarts Great Hall, Zeus × Mount Olympus) while
-- the historical layer keeps the existing PII/sensitivity rules.

ALTER TABLE person_profiles
  ADD COLUMN IF NOT EXISTS realm TEXT NOT NULL DEFAULT 'historical';
ALTER TABLE landmark_profiles
  ADD COLUMN IF NOT EXISTS realm TEXT NOT NULL DEFAULT 'historical';

CREATE INDEX IF NOT EXISTS person_profiles_realm_idx
  ON person_profiles (realm);
CREATE INDEX IF NOT EXISTS landmark_profiles_realm_idx
  ON landmark_profiles (realm);
