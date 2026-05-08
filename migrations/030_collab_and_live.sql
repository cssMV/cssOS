-- CSSOS_PERSON_MV_WAVE30_31 20260508 — Jing
-- Wave 30: team collab MV creation. Multi-user share a creation
-- session with stage-role assignments (lyrics/cover/music/...).
-- Wave 31: live creation broadcast. Spectators long-poll a room's
-- event feed while the host runs the pipeline.
--
-- Both ship polling-based for v1 (collab: short poll; live: long
-- poll w/ chunked-transfer heartbeats). WebSocket deferred.

-- Wave 30 — collab sessions
CREATE TABLE IF NOT EXISTS collab_sessions (
  session_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id   TEXT,
  creator_id  UUID NOT NULL,
  state       JSONB NOT NULL DEFAULT '{}'::jsonb,
  status      TEXT NOT NULL DEFAULT 'open',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collab_sessions_creator_idx
  ON collab_sessions (creator_id, created_at DESC);
CREATE INDEX IF NOT EXISTS collab_sessions_status_idx
  ON collab_sessions (status, created_at DESC);

CREATE TABLE IF NOT EXISTS collab_session_members (
  session_id UUID NOT NULL REFERENCES collab_sessions(session_id) ON DELETE CASCADE,
  user_id    UUID NOT NULL,
  role       TEXT NOT NULL,
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);
CREATE INDEX IF NOT EXISTS collab_session_members_user_idx
  ON collab_session_members (user_id);

CREATE TABLE IF NOT EXISTS collab_stage_outputs (
  session_id     UUID NOT NULL REFERENCES collab_sessions(session_id) ON DELETE CASCADE,
  stage_id       TEXT NOT NULL,
  contributor_id UUID NOT NULL,
  output         JSONB NOT NULL,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, stage_id)
);
CREATE INDEX IF NOT EXISTS collab_stage_outputs_session_idx
  ON collab_stage_outputs (session_id, submitted_at DESC);

-- Wave 31 — live creation rooms
CREATE TABLE IF NOT EXISTS live_creation_rooms (
  room_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL,
  person_id        TEXT,
  status           TEXT NOT NULL DEFAULT 'waiting',
  spectator_count  INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_creation_rooms_status_idx
  ON live_creation_rooms (status, created_at DESC);

CREATE TABLE IF NOT EXISTS live_room_events (
  id         BIGSERIAL PRIMARY KEY,
  room_id    UUID NOT NULL REFERENCES live_creation_rooms(room_id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS live_room_events_room_idx
  ON live_room_events (room_id, id);
