//! CSSOS_PHASE_C_4_RUST_SIGNING 20260506 — Jing
//!
//! Rust mirror of Express's media-URL signing layer (src/index.ts).
//! Same HMAC-SHA256 over the same `(workId, file, expiry, kind)`
//! payload so tokens issued by Express are valid here, and tokens
//! issued here will be valid in Express. That symmetry is what lets
//! Phase D flip nginx from Express to rust-api without re-signing
//! anyone's in-flight URLs.
//!
//! Token format (URL params):
//!   t = base64url(HMAC-SHA256(secret, "<workId>|<file>|<exp>|<kind>"))
//!   e = unix-millis expiry
//!   k = "full" | "preview"
//!
//! Secret comes from `MEDIA_SIGNING_SECRET` env, falling back to
//! `SESSION_SECRET` to match Express's resolution order. If both are
//! empty, falls back to the same hard-coded default Express uses
//! (`"cssos_session_secret"`) — never desirable in prod, but keeps
//! local dev functional with no env at all.
//!
//! D-cutover plan:
//!   1. C.4 lands this module + a /secure/artifacts/:wid/:file axum
//!      handler that mirrors the Express route byte-for-byte.
//!   2. D flips nginx upstream for /secure/* from :3000 to :8081.
//!      Existing tokens keep working because the HMAC math is
//!      identical.
//!   3. Once stable, the rust-api endpoints that emit URLs (works
//!      mine/market/public) get wired to call sign_artifact_url, and
//!      Express's `/api/works/*` chain is retired in the same flip.

use base64::Engine;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use std::env;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccessKind {
    Full,
    Preview,
}

impl AccessKind {
    pub fn as_str(self) -> &'static str {
        match self {
            AccessKind::Full => "full",
            AccessKind::Preview => "preview",
        }
    }
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "full" => Some(AccessKind::Full),
            "preview" => Some(AccessKind::Preview),
            _ => None,
        }
    }
}

/// Resolve the signing secret. Mirrors src/index.ts MEDIA_SIGNING_SECRET
/// resolution: env first, fallback to SESSION_SECRET, fallback to the
/// hard-coded default Express uses (so local dev works out of the box).
pub fn signing_secret() -> String {
    if let Ok(s) = env::var("MEDIA_SIGNING_SECRET") {
        let trimmed = s.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    if let Ok(s) = env::var("SESSION_SECRET") {
        let trimmed = s.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    "cssos_session_secret".to_string()
}

pub fn token_ttl_ms() -> u64 {
    env::var("MEDIA_TOKEN_TTL_MS")
        .ok()
        .and_then(|s| s.trim().parse::<u64>().ok())
        .filter(|&n| n > 0)
        .unwrap_or(60 * 60 * 1000) // 1h default — matches Express
}

pub fn preview_limit_seconds() -> u32 {
    env::var("MEDIA_PREVIEW_LIMIT_SECONDS")
        .ok()
        .and_then(|s| s.trim().parse::<u32>().ok())
        .filter(|&n| n > 0)
        .unwrap_or(30)
}

pub fn artifacts_dir() -> String {
    env::var("MV_ARTIFACTS_DIR")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "/var/lib/cssos/mv".to_string())
}

pub fn preview_cache_dir() -> String {
    env::var("MEDIA_PREVIEW_CACHE_DIR")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "/srv/cssos/shared/preview-cache".to_string())
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn b64url(bytes: &[u8]) -> String {
    base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(bytes)
}

/// Compute the HMAC over the canonical payload "<workId>|<file>|<exp>|<kind>".
/// Returns the base64url-encoded signature, matching Express's output.
pub fn sign_media_token(work_id: &str, file: &str, expires_at_ms: u64, kind: AccessKind) -> String {
    let payload = format!("{}|{}|{}|{}", work_id, file, expires_at_ms, kind.as_str());
    let mut mac =
        HmacSha256::new_from_slice(signing_secret().as_bytes()).expect("HMAC accepts any key size");
    mac.update(payload.as_bytes());
    b64url(&mac.finalize().into_bytes())
}

/// Constant-time compare so token verification can't leak bytes via
/// branch timing. Mirrors Express's crypto.timingSafeEqual usage.
pub fn verify_media_token(
    work_id: &str,
    file: &str,
    expires_at_ms: u64,
    kind: AccessKind,
    presented: &str,
) -> bool {
    if expires_at_ms < now_ms() {
        return false;
    }
    let expected = sign_media_token(work_id, file, expires_at_ms, kind);
    let a = expected.as_bytes();
    let b = presented.as_bytes();
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Build a `/secure/artifacts/<workId>/<file>?t=…&e=…&k=…` URL for a raw
/// `/artifacts/mv/<file>` path. Returns `None` if the input doesn't look
/// like one of our artifact URLs (cover-webp et al stay raw — the
/// frontend only needs signing on the mv asset family).
pub fn sign_artifact_url(work_id: &str, raw_url: Option<&str>, kind: AccessKind) -> Option<String> {
    let raw = raw_url?.trim();
    if raw.is_empty() {
        return None;
    }
    let stripped = raw.strip_prefix('/').unwrap_or(raw);
    let file = stripped.strip_prefix("artifacts/mv/")?;
    if file.is_empty() {
        return None;
    }
    let exp = now_ms().saturating_add(token_ttl_ms());
    let token = sign_media_token(work_id, file, exp, kind);
    Some(format!(
        "/secure/artifacts/{}/{}?t={}&e={}&k={}",
        urlencoding_path(work_id),
        urlencoding_path(file),
        token,
        exp,
        kind.as_str(),
    ))
}

fn urlencoding_path(s: &str) -> String {
    use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};
    // Mirror encodeURIComponent (Express side): encode everything except
    // unreserved (A-Z a-z 0-9 - _ . ~) plus !*'()*  - but keep this
    // simple and just escape the path-unsafe set.
    const UNSAFE: &AsciiSet = &CONTROLS
        .add(b' ')
        .add(b'"')
        .add(b'<')
        .add(b'>')
        .add(b'`')
        .add(b'#')
        .add(b'?')
        .add(b'&')
        .add(b'/')
        .add(b'\\')
        .add(b'%');
    utf8_percent_encode(s, UNSAFE).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_full() {
        std::env::set_var("MEDIA_SIGNING_SECRET", "test-secret-1");
        let exp = now_ms() + 60_000;
        let t = sign_media_token("w1", "mv_1.mp4", exp, AccessKind::Full);
        assert!(verify_media_token("w1", "mv_1.mp4", exp, AccessKind::Full, &t));
    }

    #[test]
    fn rejects_expired() {
        std::env::set_var("MEDIA_SIGNING_SECRET", "test-secret-2");
        let exp = now_ms().saturating_sub(1_000);
        let t = sign_media_token("w1", "mv_1.mp4", exp, AccessKind::Full);
        assert!(!verify_media_token("w1", "mv_1.mp4", exp, AccessKind::Full, &t));
    }

    #[test]
    fn rejects_kind_mismatch() {
        std::env::set_var("MEDIA_SIGNING_SECRET", "test-secret-3");
        let exp = now_ms() + 60_000;
        let t = sign_media_token("w1", "mv_1.mp4", exp, AccessKind::Full);
        assert!(!verify_media_token("w1", "mv_1.mp4", exp, AccessKind::Preview, &t));
    }

    #[test]
    fn rejects_file_mismatch() {
        std::env::set_var("MEDIA_SIGNING_SECRET", "test-secret-4");
        let exp = now_ms() + 60_000;
        let t = sign_media_token("w1", "mv_1.mp4", exp, AccessKind::Full);
        assert!(!verify_media_token("w1", "mv_2.mp4", exp, AccessKind::Full, &t));
    }
}
