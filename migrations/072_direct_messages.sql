-- CSSOS_WAVE_138 20260514 — Jing: @username DM via AI assistant.
-- 用户在 AI 助理输入 "@Yi Du 你好" 时，消息不再调 LLM，直接路由到
-- direct_messages 表；只有 @ 指向的收件人能在 AI 助理看到。

CREATE TABLE IF NOT EXISTS direct_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  -- Optional: when the sender attached a work card via "@Yi Du look at this {{work:abc-123}}"
  work_id         UUID REFERENCES user_works(id) ON DELETE SET NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS direct_messages_recipient_unread_idx
  ON direct_messages (recipient_id, created_at DESC)
 WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS direct_messages_sender_idx
  ON direct_messages (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS direct_messages_conversation_idx
  ON direct_messages (
    LEAST(sender_id, recipient_id),
    GREATEST(sender_id, recipient_id),
    created_at DESC
  );
