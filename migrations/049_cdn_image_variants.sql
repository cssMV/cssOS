-- Wave 97 — CDN + image optimization.
-- Adds WebP + thumbnail URL columns alongside existing PNG/JPEG cover columns.
-- All nullable; population is fire-and-forget by image-optimize pipeline.

ALTER TABLE IF EXISTS user_works
  ADD COLUMN IF NOT EXISTS cover_image_webp TEXT,
  ADD COLUMN IF NOT EXISTS cover_thumb_url  TEXT;

ALTER TABLE IF EXISTS person_profiles
  ADD COLUMN IF NOT EXISTS portrait_webp      TEXT,
  ADD COLUMN IF NOT EXISTS portrait_thumb_url TEXT;
