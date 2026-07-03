-- 评论支持一级回复(parent_id 指向被回复的顶层评论)。
ALTER TABLE actor_comments ADD COLUMN IF NOT EXISTS parent_id BIGINT;
CREATE INDEX IF NOT EXISTS idx_actor_comments_parent ON actor_comments (parent_id);
