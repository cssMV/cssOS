-- 数字演员分享计数(出演/评论已可算, 分享需自增列)。
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS share_count INTEGER NOT NULL DEFAULT 0;
