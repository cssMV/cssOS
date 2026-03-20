ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS work_type TEXT NOT NULL DEFAULT 'single';

UPDATE user_works
SET work_type = 'single'
WHERE work_type IS NULL OR btrim(work_type) = '';

CREATE INDEX IF NOT EXISTS user_works_user_id_work_type_idx
  ON user_works(user_id, work_type, created_at DESC);
