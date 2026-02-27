-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- USERS
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  display_name  TEXT,
  email         TEXT,
  avatar_url    TEXT,
  locale        TEXT NOT NULL DEFAULT 'en',
  role          TEXT NOT NULL DEFAULT 'user',

  profile_json  JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_uniq ON users (email) WHERE email IS NOT NULL;

-- OAUTH IDENTITIES
CREATE TABLE IF NOT EXISTS oauth_identities (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider          TEXT NOT NULL,
  provider_user_id  TEXT NOT NULL,
  provider_email    TEXT,
  provider_profile  JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE UNIQUE INDEX IF NOT EXISTS oauth_provider_user_uniq ON oauth_identities (provider, provider_user_id);

-- SESSIONS
CREATE TABLE IF NOT EXISTS sessions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,

  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ip            TEXT,
  user_agent    TEXT,

  data          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS sessions_user_created_idx ON sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

-- USER SETTINGS
CREATE TABLE IF NOT EXISTS user_settings (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  panels_json   JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- API KEYS
CREATE TABLE IF NOT EXISTS api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at    TIMESTAMPTZ,

  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL DEFAULT 'default',
  key_prefix    TEXT NOT NULL,
  key_hash      TEXT NOT NULL,
  last_used_at  TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_hash_uniq ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_user_idx ON api_keys (user_id);

-- BILLING ACCOUNT
CREATE TABLE IF NOT EXISTS billing_accounts (
  user_id                       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT now(),

  currency                      TEXT NOT NULL DEFAULT 'USD',
  balance_cents                 BIGINT NOT NULL DEFAULT 0,

  monthly_limit_cents           BIGINT NOT NULL DEFAULT 0,
  month_key                     TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  month_spend_cents             BIGINT NOT NULL DEFAULT 0,

  auto_recharge_enabled         BOOLEAN NOT NULL DEFAULT false,
  auto_recharge_threshold_cents BIGINT NOT NULL DEFAULT 0,
  auto_recharge_amount_cents    BIGINT NOT NULL DEFAULT 0,

  has_payment_method            BOOLEAN NOT NULL DEFAULT false,
  payment_meta                  JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- USAGE EVENTS
CREATE TABLE IF NOT EXISTS usage_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  api_key_id    UUID REFERENCES api_keys(id) ON DELETE SET NULL,

  route         TEXT NOT NULL,
  units         BIGINT NOT NULL DEFAULT 1,
  unit_price_cents BIGINT NOT NULL DEFAULT 0,
  cost_cents    BIGINT NOT NULL DEFAULT 0,

  allowed       BOOLEAN NOT NULL DEFAULT true,
  blocked_reason TEXT,

  request_id    TEXT,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS usage_user_time_idx ON usage_events (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_route_time_idx ON usage_events (route, created_at DESC);

-- LEDGER
CREATE TABLE IF NOT EXISTS ledger_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  type          TEXT NOT NULL,
  amount_cents  BIGINT NOT NULL,
  balance_after_cents BIGINT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'USD',

  ref_usage_event_id UUID REFERENCES usage_events(id) ON DELETE SET NULL,
  note          TEXT,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS ledger_user_time_idx ON ledger_entries (user_id, created_at DESC);

-- Works
CREATE TABLE IF NOT EXISTS works (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL,
  title         TEXT NOT NULL DEFAULT '',
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb,

  price_cents   BIGINT NOT NULL DEFAULT 0,
  currency      TEXT NOT NULL DEFAULT 'USD',
  is_listed     BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS works_user_time_idx ON works (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS work_assets (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  work_id       UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  asset_type    TEXT NOT NULL,
  url           TEXT NOT NULL,
  meta          JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS work_assets_work_idx ON work_assets (work_id);
