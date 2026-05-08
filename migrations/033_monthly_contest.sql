-- CSSOS_PERSON_MV_WAVE36 20260508 — Jing
-- Monthly creation contests. A contest constrains entries to a theme
-- and optional person_id, runs between starts_at/ends_at, and on
-- finalize awards prize_credits to the winning entry's author.

CREATE TABLE IF NOT EXISTS contests (
  contest_id TEXT PRIMARY KEY,
  title_zh TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description_zh TEXT,
  description_en TEXT,
  theme TEXT,
  person_id_required TEXT,
  prize_credits INTEGER NOT NULL DEFAULT 100,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  judge_user_ids UUID[] NOT NULL DEFAULT '{}',
  winner_user_id UUID,
  winner_work_id UUID,
  status TEXT NOT NULL DEFAULT 'upcoming',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contests_status_idx ON contests (status, ends_at DESC);

CREATE TABLE IF NOT EXISTS contest_entries (
  entry_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id TEXT NOT NULL,
  user_id UUID NOT NULL,
  work_id UUID NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contest_id, user_id, work_id)
);
CREATE INDEX IF NOT EXISTS contest_entries_contest_idx
  ON contest_entries (contest_id, vote_count DESC);

CREATE TABLE IF NOT EXISTS contest_votes (
  contest_id TEXT NOT NULL,
  entry_id UUID NOT NULL,
  voter_id UUID NOT NULL,
  voted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contest_id, voter_id)
);
CREATE INDEX IF NOT EXISTS contest_votes_entry_idx
  ON contest_votes (entry_id);
