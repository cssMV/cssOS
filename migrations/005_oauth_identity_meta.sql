ALTER TABLE oauth_identities
  ADD COLUMN IF NOT EXISTS provider_email TEXT NULL,
  ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS oauth_identities_user_provider_idx
  ON oauth_identities(user_id, provider);

CREATE INDEX IF NOT EXISTS oauth_identities_last_login_idx
  ON oauth_identities(user_id, last_login_at DESC);
