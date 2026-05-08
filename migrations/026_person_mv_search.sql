-- CSSOS_PERSON_MV_WAVE25 20260508 — Jing
-- Full-text search across persons / MVs / comments via tsvector + GIN.
-- Triggers keep search_vector in sync on INSERT/UPDATE; backfill is
-- idempotent (only touches NULL rows) and safe to re-run.

-- ---------- person_profiles ----------
ALTER TABLE person_profiles ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS person_profiles_search_idx
  ON person_profiles USING GIN (search_vector);

CREATE OR REPLACE FUNCTION person_profiles_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
      setweight(to_tsvector('simple', COALESCE(NEW.name_zh, '')),       'A')
   || setweight(to_tsvector('simple', COALESCE(NEW.name_en, '')),       'A')
   || setweight(to_tsvector('simple', COALESCE(NEW.civilization, '')),  'B')
   || setweight(to_tsvector('simple', COALESCE(NEW.core_theme, '')),    'C')
   || setweight(to_tsvector('simple', COALESCE(NEW.lifespan, '')),      'D');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS person_profiles_search_trigger ON person_profiles;
CREATE TRIGGER person_profiles_search_trigger
  BEFORE INSERT OR UPDATE ON person_profiles
  FOR EACH ROW EXECUTE FUNCTION person_profiles_search_update();

UPDATE person_profiles SET search_vector = NULL WHERE search_vector IS NULL;

-- ---------- person_mvs (scenario_seed) ----------
ALTER TABLE person_mvs ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS person_mvs_search_idx
  ON person_mvs USING GIN (search_vector);

CREATE OR REPLACE FUNCTION person_mvs_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
      setweight(to_tsvector('simple', COALESCE(NEW.scenario_seed, '')), 'A');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS person_mvs_search_trigger ON person_mvs;
CREATE TRIGGER person_mvs_search_trigger
  BEFORE INSERT OR UPDATE ON person_mvs
  FOR EACH ROW EXECUTE FUNCTION person_mvs_search_update();

UPDATE person_mvs SET search_vector = NULL WHERE search_vector IS NULL;

-- ---------- person_mv_comments (body) ----------
ALTER TABLE person_mv_comments ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS person_mv_comments_search_idx
  ON person_mv_comments USING GIN (search_vector);

CREATE OR REPLACE FUNCTION person_mv_comments_search_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
      setweight(to_tsvector('simple', COALESCE(NEW.body, '')), 'A');
  RETURN NEW;
END $$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS person_mv_comments_search_trigger ON person_mv_comments;
CREATE TRIGGER person_mv_comments_search_trigger
  BEFORE INSERT OR UPDATE ON person_mv_comments
  FOR EACH ROW EXECUTE FUNCTION person_mv_comments_search_update();

UPDATE person_mv_comments SET search_vector = NULL WHERE search_vector IS NULL;
