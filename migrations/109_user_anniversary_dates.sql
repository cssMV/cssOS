-- CSSOS_PHASE2_PERSONALIZATION_STAGE_H2 20260712 — Jing
--
-- Ship the user-anniversary date columns the Stage H handlers
-- (anniversary_marriage / anniversary_other) have been waiting on.
-- Until now user_preferences only carried `birthday`; the anniversary
-- triggers were registered but had no date to fire off. This adds:
--
--   • anniversary_marriage_date — the user's wedding anniversary (DATE)
--   • anniversary_other_date    — one approved custom anniversary (DATE)
--   • anniversary_other_label   — human label for the custom one
--                                 (e.g. "Business founding", "Graduation")
--   • anniversary_opt_in        — per-feature opt-in, mirrors
--                                 birthday_opt_in. Master gift_opt_out
--                                 still overrides everything.
--
-- The daily anniversary flush (runDailyAnniversaryFlush) reuses the
-- existing `birthday_timezone` as the user's local timezone for
-- day-boundary matching — a user has one home timezone, no need for a
-- second column.
--
-- migrate.ts re-runs every .sql on each boot, so every statement here
-- is idempotent (ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS).

ALTER TABLE user_preferences
  ADD COLUMN IF NOT EXISTS anniversary_marriage_date DATE,
  ADD COLUMN IF NOT EXISTS anniversary_other_date    DATE,
  ADD COLUMN IF NOT EXISTS anniversary_other_label   TEXT,
  ADD COLUMN IF NOT EXISTS anniversary_opt_in        BOOLEAN NOT NULL DEFAULT false;

-- Lookup index for the daily anniversary cron: scan today's marriage
-- anniversaries without a full-table scan. Partial index — only
-- opted-in rows with a real date set.
CREATE INDEX IF NOT EXISTS user_preferences_anniv_marriage_idx
  ON user_preferences (
    EXTRACT(MONTH FROM anniversary_marriage_date),
    EXTRACT(DAY   FROM anniversary_marriage_date)
  )
 WHERE anniversary_marriage_date IS NOT NULL AND anniversary_opt_in = true;

-- Same for the custom "other" anniversary.
CREATE INDEX IF NOT EXISTS user_preferences_anniv_other_idx
  ON user_preferences (
    EXTRACT(MONTH FROM anniversary_other_date),
    EXTRACT(DAY   FROM anniversary_other_date)
  )
 WHERE anniversary_other_date IS NOT NULL AND anniversary_opt_in = true;
