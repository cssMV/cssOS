-- CSSOS_PERSON_MV_WAVE69+70 20260508 — Jing
-- Wave 69 (plaza feed) needs no schema changes; ranking is computed at
-- query time from existing person_mvs.view_count / like_count / created_at.
-- Wave 70 (Chinese full-text segmentation) adds an additive
-- `search_text_tokenized` TEXT column on each searched table. The
-- application populates it (CJK bigrams or jieba output) so that
-- to_tsvector('simple', tokenized) yields useful CJK matches.
ALTER TABLE person_profiles    ADD COLUMN IF NOT EXISTS search_text_tokenized TEXT;
ALTER TABLE person_mvs         ADD COLUMN IF NOT EXISTS search_text_tokenized TEXT;
ALTER TABLE person_mv_comments ADD COLUMN IF NOT EXISTS search_text_tokenized TEXT;

-- The existing GIN index on search_vector still serves Latin queries.
-- For CJK we use a separate GIN index on a tsvector built from the
-- tokenized text at query time. Generated columns would be ideal but
-- ALTER TABLE ... ADD COLUMN GENERATED requires a fixed expression and
-- newer PG; instead we index the expression directly.
CREATE INDEX IF NOT EXISTS person_profiles_tok_idx
  ON person_profiles USING GIN (to_tsvector('simple', COALESCE(search_text_tokenized, '')));
CREATE INDEX IF NOT EXISTS person_mvs_tok_idx
  ON person_mvs USING GIN (to_tsvector('simple', COALESCE(search_text_tokenized, '')));
CREATE INDEX IF NOT EXISTS person_mv_comments_tok_idx
  ON person_mv_comments USING GIN (to_tsvector('simple', COALESCE(search_text_tokenized, '')));

-- Composite index helping plaza ranking (recent + popular).
CREATE INDEX IF NOT EXISTS person_mvs_plaza_idx
  ON person_mvs (view_count DESC, created_at DESC)
  WHERE visibility = 'public' AND approval_status = 'auto_published';
