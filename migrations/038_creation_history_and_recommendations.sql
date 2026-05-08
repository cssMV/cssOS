-- CSSOS_PERSON_MV_WAVE51_52 20260508 — Jing
-- Wave 51: creation timeline / history. Every user action during MV
-- creation is logged so users can replay their own decisions
-- ("15 sec ago: switched to Cyberpunk"). Backed by a single append-only
-- table indexed by user_id and run_id so the per-run replay endpoint is
-- a single index hit. Payload is JSONB so we can evolve event shapes
-- without further migrations.
--
-- Wave 52: smart recommendations. No new table — the recommender combines
-- ai_chat_memory.preferences (Wave 47) with creation_history (Wave 51) and
-- the existing person_mvs view counts (no admin trends table exists yet,
-- so "trending" comes from per-person aggregate views). Cold start =
-- pure top-trending, computed at query time.

CREATE TABLE IF NOT EXISTS creation_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  work_id UUID,
  run_id TEXT,
  event_kind TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creation_history_user_idx
  ON creation_history (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS creation_history_run_idx
  ON creation_history (run_id) WHERE run_id IS NOT NULL;
