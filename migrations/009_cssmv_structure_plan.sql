ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS structure_plan JSONB NULL DEFAULT NULL;

CREATE INDEX IF NOT EXISTS user_works_structure_plan_idx
  ON user_works
  USING GIN (structure_plan);
