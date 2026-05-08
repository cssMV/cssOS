-- CSSOS_PERSON_MV_WAVE28 20260508 — Jing
-- Creation template market: users save MV-pipeline seeds others can fork/use.
-- Additive; mirrored by ensurePersonMvTables self-heal.
CREATE TABLE IF NOT EXISTS person_mv_templates (
  template_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  name            TEXT NOT NULL,
  description     TEXT,
  seed            JSONB NOT NULL,
  visibility      TEXT NOT NULL DEFAULT 'public',
  fork_count      INTEGER NOT NULL DEFAULT 0,
  use_count       INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS person_mv_templates_user_idx
  ON person_mv_templates (user_id);
CREATE INDEX IF NOT EXISTS person_mv_templates_use_count_idx
  ON person_mv_templates (use_count DESC);
