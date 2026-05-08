-- CSSOS_PERSON_MV_WAVE76 + WAVE77 20260508 — Jing
-- Wave 76: $9.99/mo Premium subscription columns + event log.
-- Wave 77: Affiliate / referral attribution + reward ledger.
-- Both fully additive — no destructive ALTERs.

-- ── Wave 76: Premium ──────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS subscription_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL,
  event_kind TEXT NOT NULL, -- 'subscribed','renewed','cancelled','expired','failed_payment'
  stripe_event_id TEXT UNIQUE,
  amount_usd NUMERIC,
  payload JSONB,
  occurred_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS subscription_events_user_idx
  ON subscription_events (user_id, occurred_at DESC);

-- ── Wave 77: Affiliate ────────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_id UUID;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inviter_id UUID NOT NULL,
  invitee_id UUID NOT NULL,
  reward_kind TEXT NOT NULL, -- 'signup_bonus' | 'commission'
  amount_credits BIGINT NOT NULL,
  awarded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_rewards_inviter_idx
  ON referral_rewards (inviter_id, awarded_at DESC);

-- One signup_bonus per (inviter,invitee) pair — enforces "cap one reward per invitee".
CREATE UNIQUE INDEX IF NOT EXISTS referral_rewards_signup_uniq
  ON referral_rewards (inviter_id, invitee_id)
  WHERE reward_kind = 'signup_bonus';
