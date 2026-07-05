-- CSSOS_WAVE_1531 — 群演 opt-in. A digital actor can volunteer to play EXTRAS
-- (background/群演) for exposure. Casting fills extras from willing actors first
-- (same-civilization preferred), then falls back to system-generated synthetics.
-- Additive + idempotent.
ALTER TABLE digital_actors ADD COLUMN IF NOT EXISTS willing_extra BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS digital_actors_willing_extra_idx
  ON digital_actors (willing_extra) WHERE willing_extra = true;
