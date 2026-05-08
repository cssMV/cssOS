-- CSSOS_PERSON_MV_WAVE74 20260508 — Jing
-- Tutorials authored by admins, optionally bound to a person_mv_templates
-- row (Wave 28). Markdown rendered server-side with strict whitelist.
-- Additive; safe to re-run.
CREATE TABLE IF NOT EXISTS tutorials (
  tutorial_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title_zh      TEXT NOT NULL,
  title_en      TEXT NOT NULL,
  body_md       TEXT NOT NULL,
  body_en_md    TEXT,
  template_id   UUID REFERENCES person_mv_templates(template_id),
  difficulty    TEXT NOT NULL DEFAULT 'beginner',
  emoji         TEXT,
  cover_image   TEXT,
  view_count    INTEGER NOT NULL DEFAULT 0,
  published_at  TIMESTAMPTZ,
  created_by    UUID NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tutorials_published_idx
  ON tutorials (published_at DESC) WHERE published_at IS NOT NULL;
