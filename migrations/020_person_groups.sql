-- CSSOS_PERSON_MV_WAVE16 20260508 — Jing
-- Schools/Groups (流派 / 学派) — group persons into intellectual movements
-- (儒家 / 道家 / 古希腊哲学 / 文艺复兴 / 启蒙科学 / etc.) and link a
-- collective MV to each group. Additive, idempotent.

CREATE TABLE IF NOT EXISTS person_groups (
  group_id TEXT PRIMARY KEY,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description_zh TEXT,
  description_en TEXT,
  era TEXT,
  civilization TEXT,
  visual_theme JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS person_group_members (
  group_id TEXT NOT NULL REFERENCES person_groups(group_id) ON DELETE CASCADE,
  person_id TEXT NOT NULL REFERENCES person_profiles(person_id) ON DELETE CASCADE,
  role TEXT,
  PRIMARY KEY (group_id, person_id)
);

CREATE INDEX IF NOT EXISTS person_group_members_person_idx
  ON person_group_members (person_id);

CREATE TABLE IF NOT EXISTS person_group_mvs (
  mv_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL REFERENCES person_groups(group_id) ON DELETE CASCADE,
  work_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS person_group_mvs_group_idx
  ON person_group_mvs (group_id, created_at DESC);
