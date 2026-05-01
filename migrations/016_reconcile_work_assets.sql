CREATE TABLE IF NOT EXISTS work_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  work_id UUID NOT NULL REFERENCES user_works(id) ON DELETE CASCADE,
  asset_type TEXT NOT NULL,
  url TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE work_assets
  DROP CONSTRAINT IF EXISTS work_assets_work_id_fkey;

ALTER TABLE work_assets
  ADD CONSTRAINT work_assets_work_id_fkey
  FOREIGN KEY (work_id) REFERENCES user_works(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS work_assets_work_idx
  ON work_assets(work_id);

CREATE UNIQUE INDEX IF NOT EXISTS work_assets_work_asset_type_idx
  ON work_assets(work_id, asset_type);
