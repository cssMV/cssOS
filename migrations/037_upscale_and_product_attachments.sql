-- CSSOS_PERSON_MV_WAVE45_48 20260508 — Jing
-- Wave 45: video upscale jobs (1080p / 4K) on finished MVs.
-- Wave 48: 1-3 product attachments per MV for live shopping links.

ALTER TABLE user_works
  ADD COLUMN IF NOT EXISTS upscale_jobs JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS upscale_jobs (
  job_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL,
  user_id UUID NOT NULL,
  source_url TEXT NOT NULL,
  target_resolution TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  output_url TEXT,
  credits_spent INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS upscale_jobs_user_idx
  ON upscale_jobs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS upscale_jobs_work_idx
  ON upscale_jobs (work_id, created_at DESC);

CREATE TABLE IF NOT EXISTS mv_product_attachments (
  attachment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_id UUID NOT NULL,
  position INTEGER NOT NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT,
  price_text TEXT,
  timestamp_secs NUMERIC,
  click_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_id, position)
);
CREATE INDEX IF NOT EXISTS mv_product_attachments_work_idx
  ON mv_product_attachments (work_id);
