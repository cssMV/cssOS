-- CSSOS_PERSON_MV_WAVE23 20260508 — Jing
-- Festival roster for "节日特辑" homepage shelf + festival pages.
-- Additive only. The boot path in src/index.ts also self-heals this table
-- via ensurePersonMvTables() so a fresh DB without migrations applied
-- still surfaces festivals.
CREATE TABLE IF NOT EXISTS festivals (
  festival_id      TEXT PRIMARY KEY,
  name_zh          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  description_zh   TEXT,
  description_en   TEXT,
  date_rule        TEXT NOT NULL,                       -- "lunar:1-1" | "gregorian:12-25"
  emoji            TEXT,
  theme_color      TEXT,
  featured_persons TEXT[] NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS festivals_rule_idx ON festivals (date_rule);
