-- CSSOS_PERSON_MV_WAVE67 20260508 — Jing — DM groups (Slack-thread style).
-- Extends Wave 63 dm_threads for multi-user group chats while preserving
-- existing 1v1 pair semantics.
ALTER TABLE dm_threads ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'pair';
ALTER TABLE dm_threads ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE dm_threads ADD COLUMN IF NOT EXISTS owner_id UUID;
ALTER TABLE dm_threads ALTER COLUMN user_a_id DROP NOT NULL;
ALTER TABLE dm_threads ALTER COLUMN user_b_id DROP NOT NULL;
ALTER TABLE dm_threads DROP CONSTRAINT IF EXISTS dm_threads_check;

CREATE TABLE IF NOT EXISTS dm_group_members (
  thread_id UUID NOT NULL REFERENCES dm_threads(thread_id) ON DELETE CASCADE,
  user_id   UUID NOT NULL,
  role      TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'admin' | 'member'
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  PRIMARY KEY (thread_id, user_id)
);
CREATE INDEX IF NOT EXISTS dm_group_members_user_idx
  ON dm_group_members (user_id);
CREATE INDEX IF NOT EXISTS dm_group_members_thread_idx
  ON dm_group_members (thread_id);

-- CSSOS_PERSON_MV_WAVE68 20260508 — Jing — Contest LLM judge scores.
-- Fire-and-forget LLM judging supplements human votes via combined ranking.
CREATE TABLE IF NOT EXISTS contest_llm_scores (
  entry_id   UUID NOT NULL REFERENCES contest_entries(entry_id) ON DELETE CASCADE,
  creativity NUMERIC,
  craft      NUMERIC,
  relevance  NUMERIC,
  overall    NUMERIC,
  reasoning  TEXT,
  model      TEXT,
  scored_at  TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (entry_id)
);
CREATE INDEX IF NOT EXISTS contest_llm_scores_overall_idx
  ON contest_llm_scores (overall DESC);
