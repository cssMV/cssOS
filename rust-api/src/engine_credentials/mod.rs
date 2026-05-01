//! CSSOS_PHASE2_BYOK 20260420 — Bring-Your-Own-Key plumbing for third-party
//! engines (Runway first; ElevenLabs / Stability / future Suno follow the
//! same template).
//!
//! The lifecycle:
//!   1. User adds their key on the Settings panel (`POST /api/settings/
//!      engine-keys`). We encrypt + store; run whoami() to prove the key
//!      works and stamp `last_validated_at`.
//!   2. Dispatch calls `resolve_engine_key(pool, user_id, "runway")` which
//!      returns `Some((key, row_id))` if the user has an active credential.
//!      `None` ⇒ caller falls back to the platform env key (or errors with
//!      "upstream not configured" if neither path is available).
//!   3. Billing consults `is_user_key(row_id.is_some())` to zero the
//!      third-party API cost (we still charge an orchestration fee).
//!
//! A per-request resolution always checks the DB — we deliberately do *not*
//! cache plaintext in memory across requests. The cost is one cheap
//! indexed lookup; the upside is that revoke + rotation take effect
//! immediately without cache invalidation.

pub mod api;
pub mod crypto;
pub mod store;

use crate::config::Config;
use sqlx::PgPool;
use uuid::Uuid;

pub use crypto::{decrypt, encrypt, key_suffix, CryptoError, MasterKey};
pub use store::EngineCredentialRow;

/// Result of resolving a third-party API key for a user+engine pair. The
/// `source` field lets callers decide pricing: `User` ⇒ skip upstream API
/// cost, `Platform` ⇒ charge normally, `NotConfigured` ⇒ 503.
#[derive(Debug, Clone)]
pub enum ResolvedKey {
    /// User brought their own key. Caller uses `plaintext`, stamps
    /// `row_id` via `mark_used` on success, and treats this as free to
    /// the platform (orchestration fee only).
    User {
        plaintext: String,
        row_id: Uuid,
    },
    /// Fall back to the platform key. Caller pays the normal engine price.
    Platform {
        plaintext: String,
    },
    /// Neither path configured — upstream is unreachable. Caller should
    /// return a `upstream_not_configured` 503 with a helpful next step
    /// ("add your Runway key in Settings → Engine Accounts, or ask the
    /// admin to set RUNWAY_API_KEY").
    NotConfigured,
}

impl ResolvedKey {
    pub fn is_user_key(&self) -> bool {
        matches!(self, ResolvedKey::User { .. })
    }

    pub fn plaintext(&self) -> Option<&str> {
        match self {
            ResolvedKey::User { plaintext, .. } => Some(plaintext.as_str()),
            ResolvedKey::Platform { plaintext } => Some(plaintext.as_str()),
            ResolvedKey::NotConfigured => None,
        }
    }
}

/// Look up the user's BYOK entry for `engine_key`. Returns the decrypted
/// plaintext when the user has an active credential. Falls back to the
/// platform env var if `platform_env_fallback` is Some(name).
///
/// Errors surface as ResolvedKey::NotConfigured rather than Err so the
/// caller can uniformly 503 without having to distinguish "DB gone" from
/// "key missing" at the HTTP boundary — both map to the same UX message
/// and we log the underlying cause via `tracing`.
pub async fn resolve_engine_key(
    pool: &PgPool,
    master: Option<&MasterKey>,
    user_id: Uuid,
    engine_key: &str,
    platform_env_fallback: Option<&str>,
) -> ResolvedKey {
    // 1. BYOK path — only viable when master key is loaded.
    if let Some(master) = master {
        match store::get(pool, user_id, engine_key).await {
            Ok(Some(row)) => match crypto::decrypt(master, &row.encrypted_key) {
                Ok(pt) => {
                    if let Ok(s) = String::from_utf8(pt) {
                        return ResolvedKey::User {
                            plaintext: s,
                            row_id: row.id,
                        };
                    }
                    tracing::warn!(
                        engine = engine_key,
                        user_id = %user_id,
                        "BYOK plaintext was not valid UTF-8; falling back"
                    );
                }
                Err(e) => {
                    tracing::warn!(
                        engine = engine_key,
                        user_id = %user_id,
                        err = ?e,
                        "BYOK decrypt failed; falling back"
                    );
                }
            },
            Ok(None) => { /* no credential ⇒ try platform fallback */ }
            Err(e) => {
                tracing::warn!(
                    engine = engine_key,
                    user_id = %user_id,
                    err = ?e,
                    "engine_credentials lookup failed; falling back"
                );
            }
        }
    }

    // 2. Platform key path.
    if let Some(env_name) = platform_env_fallback {
        if let Ok(v) = std::env::var(env_name) {
            let trimmed = v.trim().to_string();
            if !trimmed.is_empty() {
                return ResolvedKey::Platform { plaintext: trimmed };
            }
        }
    }

    ResolvedKey::NotConfigured
}

/// Construct a MasterKey from the process config. Returns `None` when the
/// operator hasn't set `ENGINE_CRED_MASTER_KEY`; the dispatch path treats
/// this as "BYOK feature disabled" and falls straight through to platform
/// keys. We log once so the operator can spot the misconfiguration.
pub fn master_key_from_config(cfg: &Config) -> Option<MasterKey> {
    let raw = cfg.engine_cred_master_key.trim();
    if raw.is_empty() {
        return None;
    }
    match MasterKey::from_base64(raw) {
        Ok(k) => Some(k),
        Err(e) => {
            tracing::error!(err = ?e, "ENGINE_CRED_MASTER_KEY invalid; BYOK disabled");
            None
        }
    }
}
