-- CSSOS_WAVE_152 20260514 — Jing: 请保存聊天记录，除非用户手动清除.
-- The AI-assistant conversation lived only in an in-memory Map with a
-- 1-hour idle TTL, so a server restart or an hour of inactivity wiped
-- it — and the client session_id lived in sessionStorage, so closing
-- the app/tab also lost the thread. This table persists the full
-- conversation per (user, session) until the user explicitly clears it.

CREATE TABLE IF NOT EXISTS agent_chat_sessions (
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id   TEXT NOT NULL,
  -- Full AgentMessage[] array (role + content blocks) as JSONB.
  messages     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS agent_chat_sessions_user_idx
  ON agent_chat_sessions (user_id, updated_at DESC);
