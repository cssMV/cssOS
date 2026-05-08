-- CSSOS_PERSON_MV_WAVE44_47 20260508 — Jing
-- Wave 44: LLM-assisted moderation verdicts on content_reports.
-- Wave 47: per-user AI chat long-term memory.

ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS llm_verdict TEXT;
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS llm_confidence NUMERIC;
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS llm_reasoning TEXT;
ALTER TABLE content_reports ADD COLUMN IF NOT EXISTS auto_resolved_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS ai_chat_memory (
  user_id              UUID PRIMARY KEY,
  preferences          JSONB NOT NULL DEFAULT '{}'::jsonb,
  recent_conversations JSONB NOT NULL DEFAULT '[]'::jsonb,
  last_updated         TIMESTAMPTZ NOT NULL DEFAULT now()
);
