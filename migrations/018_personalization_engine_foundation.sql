-- CSSOS_PHASE2_PERSONALIZATION_FOUNDATION 20260502 #268 — Jing
-- Stage A foundation for the personalization engine. Three concerns:
--   1. user_preferences (per-user gift settings: birthday, opt-out, quiet hours)
--   2. system_gift_audit (every gift trigger leaves a row — compliance + analytics)
--   3. cssOS · Curator system pseudo-user (stable owner_user_id for system MVs)
--
-- The migration is idempotent (CREATE TABLE IF NOT EXISTS / ON CONFLICT).
-- No data writes besides the curator user — the engine itself comes in
-- src/personalization/ in this same commit.

BEGIN;

----------------------------------------------------------------------
-- 1. user_preferences
----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Birthday MV support. Nullable + opt-in flag so we never gift a
  -- birthday MV to a user who hasn't shared the date or who opted out.
  birthday DATE,
  birthday_timezone TEXT,                -- IANA tz, e.g. 'Asia/Shanghai'
  birthday_opt_in BOOLEAN NOT NULL DEFAULT false,

  -- Master gift opt-out. When true, NO system gift MVs are dispatched
  -- (welcome, milestones, birthdays, anniversaries — everything).
  gift_opt_out BOOLEAN NOT NULL DEFAULT false,

  -- Quiet hours: don't fire celebrations during this window in the
  -- user's local time. Defaults to 11pm–7am. NULL → no quiet hours.
  quiet_hours_start_local TIME DEFAULT '23:00',
  quiet_hours_end_local   TIME DEFAULT '07:00',

  -- Per-user terms acceptance for the personalization features (the
  -- handful of opt-ins that touch real-name embedding etc).
  accepted_personalization_terms_at TIMESTAMPTZ,

  -- Override locale for gift content. Falls back to users.locale.
  preferred_gift_language TEXT,

  -- Display name override the user wants embedded in their gift MVs
  -- (e.g. "Jing" instead of "Jing Du"). Defaults to users.display_name.
  preferred_gift_display_name TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lookup index for the daily birthday cron (Stage F): scan today's
-- birthdays without a full-table scan. Partial index — only opted-in
-- rows with a real birthday set. The cron query will look like:
--   WHERE EXTRACT(MONTH FROM birthday) = $month
--     AND EXTRACT(DAY   FROM birthday) = $day
--     AND birthday_opt_in = true
--     AND gift_opt_out    = false
CREATE INDEX IF NOT EXISTS user_preferences_birthday_idx
  ON user_preferences (
    EXTRACT(MONTH FROM birthday),
    EXTRACT(DAY   FROM birthday)
  )
 WHERE birthday IS NOT NULL AND birthday_opt_in = true;

----------------------------------------------------------------------
-- 2. system_gift_audit
----------------------------------------------------------------------
-- Every system gift MV — successful or not — leaves a row. Lets us:
--   • detect rate-limit / cooldown violations after the fact
--   • compute per-trigger cost over time
--   • show the user a "your gifts" inbox
--   • debug regression: "did the welcome MV trigger for this user?"
CREATE TABLE IF NOT EXISTS system_gift_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Which trigger fired. Free-form text so new triggers don't need
  -- a schema change; the engine validates against its registry.
  -- Examples: 'welcome', 'first_subscriber', 'milestone_100',
  -- 'milestone_1000', 'birthday', 'plan_upgrade', 'plan_downgrade',
  -- 'account_deletion', 'anniversary_marriage', 'feedback_adopted',
  -- 'streak_30day', 'welcome_back'.
  trigger_event TEXT NOT NULL,

  -- The original event data (Stripe payload, plan-change request,
  -- birthday cron run id, etc.) for replay / debugging.
  trigger_payload JSONB,

  -- Recipient
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_email TEXT,                  -- snapshot at gift time
  recipient_display_name TEXT,           -- snapshot — so MV credits stay
                                         -- correct even if user renames
  recipient_locale TEXT,                 -- snapshot of language used

  -- The actual generated MV. NULL while pending / generating; set
  -- once the work record exists.
  work_id UUID,

  -- If the gift used a pre-rendered template (Stage B), record which.
  -- NULL means "fully generated from scratch".
  template_id TEXT,

  -- Lifecycle
  --   pending      — queued, not yet dispatched (e.g. quiet hours)
  --   generating   — handler called, MV being made
  --   delivered    — work_id set, user can see it in their inbox
  --   viewed       — user opened the gift at least once
  --   failed       — handler error, see failure_reason
  --   rate_limited — cooldown / per-year cap hit, no MV generated
  --   opted_out    — user has gift_opt_out=true, skipped silently
  status TEXT NOT NULL DEFAULT 'pending',

  -- Generation cost in cents (for budget tracking). 0 for templated
  -- gifts that just swap a name overlay onto a pre-rendered MV.
  cost_cents INTEGER NOT NULL DEFAULT 0,

  -- Stripe livemode mirror — useful when the trigger payload is a
  -- Stripe event, so we can filter out test-mode noise in reports.
  livemode BOOLEAN NOT NULL DEFAULT true,

  dispatched_at TIMESTAMPTZ DEFAULT now(),
  delivered_at  TIMESTAMPTZ,
  viewed_at     TIMESTAMPTZ,
  failed_at     TIMESTAMPTZ,
  failure_reason TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-user history lookup (cooldown checks, "my gifts" inbox).
CREATE INDEX IF NOT EXISTS system_gift_audit_target_idx
  ON system_gift_audit (target_user_id, trigger_event, dispatched_at DESC);

-- Worker queue scan (find pending/generating rows older than X minutes
-- so we can retry stuck generations).
CREATE INDEX IF NOT EXISTS system_gift_audit_pending_idx
  ON system_gift_audit (status, dispatched_at)
  WHERE status IN ('pending', 'generating');

-- Cost reporting per trigger over a date window.
CREATE INDEX IF NOT EXISTS system_gift_audit_cost_idx
  ON system_gift_audit (trigger_event, dispatched_at)
  WHERE status IN ('delivered', 'viewed');

----------------------------------------------------------------------
-- 3. cssOS · Curator system pseudo-user
----------------------------------------------------------------------
-- Every system-generated MV is owned by this account. Combined with
-- the #266 anti-self-dealing rule (anything @cssstudio.app is free +
-- priceless + can't be bought out), system gifts inherit those exact
-- semantics for free.
--
-- The id is a fixed sentinel UUID so application code can reference
-- it as a constant without a lookup. The email lives in the existing
-- @cssstudio.app domain so the admin checks fire correctly.
-- The users table only has a PK on id (no unique on email), so we
-- conflict on id. The id is a fixed sentinel UUID picked once for
-- the lifetime of the platform.
INSERT INTO users (id, email, display_name, avatar_url, locale, role, created_at)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'system@cssstudio.app',
  'cssOS · Curator',
  '/assets/cssos-system-avatar.png',
  'en',
  'admin',
  now()
)
ON CONFLICT (id) DO UPDATE
  SET email        = EXCLUDED.email,
      display_name = EXCLUDED.display_name,
      role         = EXCLUDED.role;

-- Seed a user_preferences row so the Curator never accidentally
-- receives system gifts.
INSERT INTO user_preferences (user_id, gift_opt_out, accepted_personalization_terms_at)
VALUES ('00000000-0000-0000-0000-000000000001', true, now())
ON CONFLICT (user_id) DO UPDATE
  SET gift_opt_out = true,
      updated_at   = now();

COMMIT;
