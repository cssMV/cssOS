CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  display_name TEXT NULL,
  email TEXT NULL,
  avatar_url TEXT NULL,
  default_role TEXT NOT NULL DEFAULT 'user',
  locale TEXT NOT NULL DEFAULT 'en',
  raw_profile JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS oauth_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_user_id TEXT NOT NULL,
  access_token TEXT NULL,
  refresh_token TEXT NULL,
  expires_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(provider, provider_user_id)
);

CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT NOT NULL DEFAULT 'USD',
  balance_cents BIGINT NOT NULL DEFAULT 0,
  auto_recharge_enabled BOOLEAN NOT NULL DEFAULT false,
  auto_recharge_amount_cents BIGINT NOT NULL DEFAULT 1000,
  auto_recharge_threshold_cents BIGINT NOT NULL DEFAULT 200,
  monthly_limit_cents BIGINT NOT NULL DEFAULT 5000,
  month_spent_cents BIGINT NOT NULL DEFAULT 0,
  month_key TEXT NOT NULL DEFAULT to_char(now(),'YYYY-MM'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  api_key_id UUID NULL,
  route TEXT NOT NULL,
  units BIGINT NOT NULL DEFAULT 0,
  cost_cents BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  balance_after_cents BIGINT NOT NULL,
  related_usage_event_id UUID NULL REFERENCES usage_events(id),
  note TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
