-- CSSOS_PERSON_MV_WAVE63 20260508 — Jing — 1v1 direct messages.
-- Pair-deduped threads (canonical user_a_id < user_b_id) + append-only
-- message log. Block enforcement happens at write time in the API.
CREATE TABLE IF NOT EXISTS dm_threads (
  thread_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a_id        UUID NOT NULL,
  user_b_id        UUID NOT NULL,
  last_message_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  a_last_read_at   TIMESTAMPTZ,
  b_last_read_at   TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (user_a_id < user_b_id),
  UNIQUE (user_a_id, user_b_id)
);
CREATE INDEX IF NOT EXISTS dm_threads_a_idx
  ON dm_threads (user_a_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS dm_threads_b_idx
  ON dm_threads (user_b_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS dm_messages (
  message_id  BIGSERIAL PRIMARY KEY,
  thread_id   UUID NOT NULL REFERENCES dm_threads(thread_id) ON DELETE CASCADE,
  sender_id   UUID NOT NULL,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dm_messages_thread_idx
  ON dm_messages (thread_id, message_id DESC);
