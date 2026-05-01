-- CSSOS_PHASE2_BYOK 20260420 — per-user encrypted 3P API keys
-- Lets users bring their own Runway/ElevenLabs/Stability/Suno keys so CSS
-- Studio skips the API cost and only charges an orchestration fee.
--
-- Key bytes are AES-256-GCM encrypted with the master key loaded from
-- ENGINE_CRED_MASTER_KEY (base64 32 bytes). The ciphertext carries its own
-- nonce in `encrypted_key` (first 12 bytes = nonce, rest = tag+ct), so the
-- DB never sees the plaintext and the master key stays in process memory.
--
-- `engine_key` is the short slug we use in code (`runway`, `elevenlabs`,
-- `stability`, `suno`). One row per (user, engine). Multiple versions of
-- the same engine share a key (Suno v4/v5 both use SUNO_API_KEY, same here).
--
-- `key_suffix` is the last 4 plaintext chars saved in plaintext so the UI
-- can render "sk-••••ab12" without us having to decrypt on every render.
-- Status tracks validation — `active` means whoami() returned 2xx,
-- `invalid` means the key was rejected upstream, `revoked` means the user
-- removed it (soft-delete so we keep audit history).

CREATE TABLE IF NOT EXISTS engine_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  engine_key TEXT NOT NULL,
  encrypted_key BYTEA NOT NULL,
  key_suffix TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  last_validated_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT engine_credentials_status_chk
    CHECK (status IN ('active', 'invalid', 'revoked'))
);

CREATE UNIQUE INDEX IF NOT EXISTS engine_credentials_user_engine_uq
  ON engine_credentials(user_id, engine_key)
  WHERE status <> 'revoked';

CREATE INDEX IF NOT EXISTS engine_credentials_user_idx
  ON engine_credentials(user_id);
