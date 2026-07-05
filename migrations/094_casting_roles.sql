-- CSSOS_WAVE_1526 — Casting P0 data model.
-- Extends the existing actor_castings table (migrations/093_digital_actors.sql)
-- from a flat actor↔work link into a role-based cast: each slot carries a role,
-- an alignment, a billing order, and a snapshotted archetype. This is the data
-- foundation for the casting entry-layer (see docs/casting-architecture-plan.md).
-- Additive + idempotent; back-compat defaults keep existing rows valid.

ALTER TABLE actor_castings
  -- protagonist | antagonist | supporting | extra  (enum-by-convention)
  ADD COLUMN IF NOT EXISTS role           TEXT    NOT NULL DEFAULT 'protagonist',
  -- good | evil | neutral
  ADD COLUMN IF NOT EXISTS alignment      TEXT    NOT NULL DEFAULT 'neutral',
  -- top billing = 0; determines display + prompt weighting order
  ADD COLUMN IF NOT EXISTS billing_order  INTEGER NOT NULL DEFAULT 0,
  -- one ROLE_TAXONOMY key (hero/villain/…), snapshotted at cast time because the
  -- actor's own archetypes[] may drift later
  ADD COLUMN IF NOT EXISTS archetype      TEXT,
  -- true = the slot was filled by the 文明智能联动 recommender, not hand-picked
  ADD COLUMN IF NOT EXISTS auto_suggested BOOLEAN NOT NULL DEFAULT false;

-- Cast is derived, ordered by billing. This is the hot read path
-- (SELECT … FROM actor_castings WHERE work_id=$1 ORDER BY billing_order).
CREATE INDEX IF NOT EXISTS idx_actor_castings_work_billing
  ON actor_castings (work_id, billing_order);

-- Guard rails on the convention enums (kept permissive; NULL-safe).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'actor_castings_role_chk') THEN
    ALTER TABLE actor_castings
      ADD CONSTRAINT actor_castings_role_chk
      CHECK (role IN ('protagonist','antagonist','supporting','extra'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'actor_castings_alignment_chk') THEN
    ALTER TABLE actor_castings
      ADD CONSTRAINT actor_castings_alignment_chk
      CHECK (alignment IN ('good','evil','neutral'));
  END IF;
END $$;
