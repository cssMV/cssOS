ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS parent_work_id UUID NULL REFERENCES user_works(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS root_work_id UUID NULL REFERENCES user_works(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS structure_role TEXT NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS sequence_index INTEGER NOT NULL DEFAULT 0;

UPDATE user_works
SET root_work_id = id
WHERE root_work_id IS NULL;

UPDATE user_works
SET structure_role = CASE
  WHEN work_type = 'opera' THEN 'opera'
  WHEN work_type = 'triptych' THEN 'triptych'
  ELSE 'single'
END
WHERE structure_role IS NULL
   OR btrim(structure_role) = ''
   OR structure_role = 'single';

CREATE INDEX IF NOT EXISTS user_works_parent_work_id_idx
  ON user_works(parent_work_id, sequence_index, created_at DESC);

CREATE INDEX IF NOT EXISTS user_works_root_work_id_idx
  ON user_works(root_work_id, sequence_index, created_at DESC);
