ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS membership_tier TEXT NOT NULL DEFAULT 'free';

ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS membership_source TEXT NOT NULL DEFAULT 'system';

ALTER TABLE billing_accounts
  ADD COLUMN IF NOT EXISTS membership_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE billing_accounts
SET membership_tier = CASE
  WHEN membership_tier IN ('guest', 'free', 'starter', 'pro', 'vip', 'admin') THEN membership_tier
  ELSE 'free'
END,
membership_source = COALESCE(NULLIF(membership_source, ''), 'system'),
membership_updated_at = COALESCE(membership_updated_at, now());

CREATE INDEX IF NOT EXISTS billing_accounts_membership_tier_idx
  ON billing_accounts(membership_tier, membership_updated_at DESC);
