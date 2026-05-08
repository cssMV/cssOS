-- CSSOS_PERSON_MV_WAVE46_49 20260508 — Jing
-- Wave 46: collab permission matrix (owner/editor/viewer) + per-stage
-- locks so two editors can't trample one another's work.
-- Wave 49: synchronized watch parties — host plays an MV, spectators
-- mirror playback over long-poll, optional 弹幕 (danmu) chat overlay.
--
-- Both additive. Watch party endpoints mirror Wave 31 long-poll shape.

-- Wave 46 — collab permission matrix + stage locks
ALTER TABLE collab_session_members
  ADD COLUMN IF NOT EXISTS permission TEXT NOT NULL DEFAULT 'editor';
-- 'owner' | 'editor' | 'viewer'

ALTER TABLE collab_sessions
  ADD COLUMN IF NOT EXISTS visibility TEXT NOT NULL DEFAULT 'invite';
-- 'invite' | 'public' | 'unlisted'

CREATE TABLE IF NOT EXISTS collab_stage_locks (
  session_id UUID NOT NULL REFERENCES collab_sessions(session_id) ON DELETE CASCADE,
  stage_id   TEXT NOT NULL,
  locked_by  UUID NOT NULL,
  locked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (session_id, stage_id)
);
CREATE INDEX IF NOT EXISTS collab_stage_locks_expires_idx
  ON collab_stage_locks (expires_at);

-- Backfill: existing owners (creators) get permission='owner'.
UPDATE collab_session_members m
   SET permission = 'owner'
  FROM collab_sessions s
 WHERE s.session_id = m.session_id
   AND s.creator_id = m.user_id
   AND m.permission <> 'owner';

-- Wave 49 — synchronized watch parties
CREATE TABLE IF NOT EXISTS watch_parties (
  party_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id         UUID NOT NULL,
  work_id         UUID NOT NULL,
  state           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- {playing: bool, currentTime: number, lastUpdated: number}
  spectator_count INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watch_parties_host_idx
  ON watch_parties (host_id, created_at DESC);
CREATE INDEX IF NOT EXISTS watch_parties_created_idx
  ON watch_parties (created_at DESC);

CREATE TABLE IF NOT EXISTS watch_party_events (
  id         BIGSERIAL PRIMARY KEY,
  party_id   UUID NOT NULL REFERENCES watch_parties(party_id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  -- "play" | "pause" | "seek" | "danmu" | "join" | "leave"
  user_id    UUID,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS watch_party_events_party_idx
  ON watch_party_events (party_id, id);
