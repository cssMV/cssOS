-- CSSOS_PERSON_MV_WAVE86+87 20260508 — Jing
-- Wave 86: remix lineage on user_works.
-- Wave 87: user-curated collections/playlists.

ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS remix_of_work_id UUID;
ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS remix_chain_root_id UUID;
CREATE INDEX IF NOT EXISTS user_works_remix_idx
  ON user_works (remix_of_work_id) WHERE remix_of_work_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS collections (
  collection_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      UUID NOT NULL,
  name          TEXT NOT NULL,
  description   TEXT,
  is_public     BOOLEAN NOT NULL DEFAULT true,
  cover_work_id UUID,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id UUID NOT NULL REFERENCES collections(collection_id) ON DELETE CASCADE,
  work_id       UUID NOT NULL,
  position      INTEGER NOT NULL,
  added_at      TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (collection_id, work_id)
);
CREATE INDEX IF NOT EXISTS collections_owner_idx
  ON collections (owner_id);
CREATE INDEX IF NOT EXISTS collection_items_position_idx
  ON collection_items (collection_id, position);
