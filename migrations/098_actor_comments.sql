-- 数字演员评论(选角/评论/分享 胶囊里的"评论"落地)。
CREATE TABLE IF NOT EXISTS actor_comments (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    TEXT NOT NULL,
  user_id     TEXT NOT NULL,
  author_name TEXT,
  body        TEXT NOT NULL,
  hidden      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_actor_comments_actor ON actor_comments (actor_id, created_at DESC);
