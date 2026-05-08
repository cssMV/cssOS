-- CSSOS_PERSON_MV_WAVE27 20260508 — Jing
-- A/B experiment infra: deterministic per-user variant assignment +
-- exposure/conversion event log. Additive; mirrored by ensurePersonMvTables
-- self-heal so a fresh DB boots clean.
CREATE TABLE IF NOT EXISTS ab_experiments (
  experiment_id   TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  variants        TEXT[] NOT NULL,
  traffic_split   JSONB NOT NULL,
  active          BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ab_assignments (
  user_id         UUID NOT NULL,
  experiment_id   TEXT NOT NULL,
  variant         TEXT NOT NULL,
  assigned_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, experiment_id)
);

CREATE TABLE IF NOT EXISTS ab_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL,
  experiment_id   TEXT NOT NULL,
  variant         TEXT NOT NULL,
  event_kind      TEXT NOT NULL,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ab_events_exp_idx
  ON ab_events (experiment_id, event_kind, created_at);
