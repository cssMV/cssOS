-- CSSOS_WAVE_480 — Jing: 作品「置顶」功能 (用户给自己作品置顶, 最多 3 个, 排在最新之上)。
ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ NULL;
CREATE INDEX IF NOT EXISTS idx_user_works_pinned ON user_works (user_id, pinned_at DESC) WHERE pinned_at IS NOT NULL;
