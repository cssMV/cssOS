-- CSSOS_WAVE_139A 20260514 — Jing
-- Group DM / discussion rooms. A room is a named multi-party thread
-- with N members. Messages live in the existing direct_messages table
-- but with room_id set (recipient_id is NULL for room messages —
-- "addressed to the room, fanned out to all members").

CREATE TABLE IF NOT EXISTS chat_rooms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  -- "群主" — the creator. Owner can add/remove members, rename, delete.
  owner_user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- Optional topic for the channel header.
  topic           TEXT,
  -- "private" (invite-only) | "public" (anyone with the link can join).
  visibility      TEXT NOT NULL DEFAULT 'private',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- archived rooms are hidden from member lists but messages stay.
  archived_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS chat_rooms_owner_idx ON chat_rooms (owner_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS chat_room_members (
  room_id         UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_read_at    TIMESTAMPTZ,
  muted_at        TIMESTAMPTZ,
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_room_members_user_idx ON chat_room_members (user_id, last_read_at);

-- Extend direct_messages with room_id (NULL for 1:1, set for room
-- messages). recipient_id stays NULL for room messages.
ALTER TABLE direct_messages
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS direct_messages_room_idx
  ON direct_messages (room_id, created_at DESC) WHERE room_id IS NOT NULL;

-- Either it's a 1:1 DM (recipient_id NOT NULL, room_id NULL) or a
-- room message (room_id NOT NULL, recipient_id NULL). Never both,
-- never neither.
-- Either 1:1 DM (recipient_id NOT NULL, room_id NULL) or room message
-- (recipient_id NULL, room_id NOT NULL).  ADD CONSTRAINT IF NOT EXISTS
-- isn't supported until PG 16, so wrap in DO block.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'direct_messages_route_xor') THEN
    ALTER TABLE direct_messages
      ADD CONSTRAINT direct_messages_route_xor CHECK (
        (recipient_id IS NOT NULL AND room_id IS NULL)
        OR
        (recipient_id IS NULL AND room_id IS NOT NULL)
      );
  END IF;
END$$;
