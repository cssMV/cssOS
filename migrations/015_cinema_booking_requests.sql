CREATE TABLE IF NOT EXISTS cinema_booking_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted',
  project_title TEXT NOT NULL DEFAULT '',
  requested_mode TEXT NOT NULL DEFAULT 'cinema',
  requested_duration_sec INTEGER NOT NULL DEFAULT 0,
  contact_email TEXT NOT NULL DEFAULT '',
  contact_handle TEXT NOT NULL DEFAULT '',
  budget_cents BIGINT NOT NULL DEFAULT 0,
  brief TEXT NOT NULL DEFAULT '',
  needs_contract BOOLEAN NOT NULL DEFAULT true,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cinema_booking_requests_user_idx
  ON cinema_booking_requests(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS cinema_booking_requests_status_idx
  ON cinema_booking_requests(status, created_at DESC);
