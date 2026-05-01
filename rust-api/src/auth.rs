use axum::{extract::FromRequestParts, http::request::Parts};
use serde_json::Value;
use sqlx::PgPool;
use tracing::warn;
use uuid::Uuid;

use crate::models::Session;

/// Build-verifiable marker for the Express session bridge. `strings` on the
/// compiled binary should find this string — if not, the deployed binary
/// predates the bridge code. Comments don't survive compilation; a `pub
/// static` with `#[used]` does. Bump the date suffix on meaningful changes.
#[used]
#[allow(dead_code)]
pub static CSSOS_PHASE2_EXPRESS_SESSION_BRIDGE_MARKER: &str =
    "CSSOS_PHASE2_INTERNAL_TRUST_20260418";

#[derive(Clone, Debug)]
pub struct AuthSession {
    pub user_id: Option<Uuid>,
}

#[axum::async_trait]
impl<S> FromRequestParts<S> for AuthSession
where
    S: Send + Sync,
{
    type Rejection = (axum::http::StatusCode, String);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let extensions = parts.extensions.clone();
        let pool = extensions.get::<PgPool>().ok_or((
            axum::http::StatusCode::INTERNAL_SERVER_ERROR,
            "db missing".to_string(),
        ))?;

        // CSSOS_PHASE2_INTERNAL_TRUST 20260418 — Express-side proxy path.
        //
        // Express has already authenticated the user against its own session
        // store (which DOES work correctly). It then proxies /api/mv/* to
        // this Rust service on 127.0.0.1:8081 with two headers:
        //
        //   X-CSSOS-Internal-Token: <shared secret from /etc/cssos.env>
        //   X-CSSOS-User:           <uuid of the authenticated user>
        //
        // The Rust listener is bound to 127.0.0.1 so this shared secret
        // never traverses the public internet. If the token matches and a
        // valid UUID is supplied we short-circuit auth — no DB round-trip,
        // no cookie parsing — and trust Express's own session decision.
        //
        // If the token env is empty or absent we silently fall through to
        // the legacy cookie bridge below, so nothing changes for callers
        // that already work.
        if let Ok(expected) = std::env::var("CSSOS_INTERNAL_TOKEN") {
            if !expected.is_empty() {
                let got_token = parts
                    .headers
                    .get("x-cssos-internal-token")
                    .and_then(|v| v.to_str().ok());
                if got_token == Some(expected.as_str()) {
                    let got_user = parts
                        .headers
                        .get("x-cssos-user")
                        .and_then(|v| v.to_str().ok())
                        .and_then(|s| Uuid::parse_str(s).ok());
                    if let Some(u) = got_user {
                        return Ok(Self { user_id: Some(u) });
                    } else {
                        warn!(
                            "auth_bridge: internal token matched but X-CSSOS-User missing/invalid"
                        );
                    }
                }
            }
        }

        let cookie_header = parts
            .headers
            .get(axum::http::header::COOKIE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        let session_cookie = extensions
            .get::<String>()
            .cloned()
            .unwrap_or_else(|| "cssos_session".to_string());

        // Find the raw `cssos_session=...` cookie value.
        let raw_value = cookie_header.split(';').map(|c| c.trim()).find_map(|c| {
            let mut kv = c.splitn(2, '=');
            let name = kv.next()?;
            let value = kv.next()?;
            if name == session_cookie {
                Some(value.to_string())
            } else {
                None
            }
        });

        let Some(raw_value) = raw_value else {
            warn!(
                cookie = %session_cookie,
                cookie_header_len = cookie_header.len(),
                "auth_bridge: no cookie with expected name"
            );
            return Ok(Self { user_id: None });
        };

        // Cookies on the wire are URL-encoded (Express sends `s%3A<sid>.<sig>`).
        let decoded = percent_decode(&raw_value);

        // Path 1 — Rust-native sessions (passkey / API-key issued): the cookie
        // value is a bare UUID that keys directly into the `sessions` table.
        if let Ok(uuid) = Uuid::parse_str(&decoded) {
            let session = sqlx::query_as::<_, Session>(
                "SELECT * FROM sessions WHERE id = $1 AND revoked_at IS NULL AND expires_at > now()",
            )
            .bind(uuid)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                warn!(err = %e, "auth_bridge: path1 sessions query failed");
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "db error".to_string(),
                )
            })?;
            if session.is_none() {
                warn!(uuid = %uuid, "auth_bridge: path1 UUID cookie matched no session row");
            }
            return Ok(Self {
                user_id: session.map(|s| s.user_id),
            });
        }

        // CSSOS_PHASE2_EXPRESS_SESSION_BRIDGE 20260418 — Path 2: Express session.
        //
        // The Rust API shares the `cssos_session` cookie with the Express
        // app (src/index.ts). Express uses express-session + connect-pg-simple,
        // which writes the cookie value as `s:<sid>.<sig>` (URL-encoded on
        // the wire as `s%3A<sid>.<sig>`) and persists session rows in the
        // `session` table (singular, connect-pg-simple default) with schema
        //     sid   text primary key
        //     sess  json  not null
        //     expire timestamp(6) with time zone not null
        // The `sess` JSON blob is the Express req.session object; after login
        // Express writes (req.session as any).user_id = userId (see
        // src/index.ts: setAuthSession), where userId is a uuid string from
        // the `users.id` column.
        //
        // We deliberately do NOT verify the HMAC signature:
        //   - sid is a cryptographically random base64url string (~32 bytes)
        //   - lookup is gated by DB presence + expiry
        //   - cookie is httpOnly + Secure over HTTPS in prod
        // That threat model is identical to the UUID path above, where
        // possession of the cookie is authentication. Skipping the sig check
        // also means Rust doesn't need to know SESSION_SECRET, and cookie
        // rotation / secret rotation doesn't break cross-stack auth.
        if let Some(sid) = parse_express_signed_cookie(&decoded) {
            let sess: Option<Value> = sqlx::query_scalar::<_, Value>(
                "SELECT sess FROM session WHERE sid = $1 AND expire > now()",
            )
            .bind(&sid)
            .fetch_optional(pool)
            .await
            .map_err(|e| {
                warn!(err = %e, sid = %sid, "auth_bridge: path2 session query failed");
                (
                    axum::http::StatusCode::INTERNAL_SERVER_ERROR,
                    "db error".to_string(),
                )
            })?;

            if let Some(sess) = sess {
                let user_id = sess
                    .get("user_id")
                    .and_then(|v| v.as_str())
                    .and_then(|s| Uuid::parse_str(s).ok());
                if user_id.is_none() {
                    warn!(
                        sid = %sid,
                        sess_keys = ?sess.as_object().map(|o| o.keys().cloned().collect::<Vec<_>>()),
                        "auth_bridge: path2 row found but user_id extract failed"
                    );
                }
                return Ok(Self { user_id });
            } else {
                warn!(sid = %sid, "auth_bridge: path2 no session row for sid");
            }
        } else {
            warn!(
                decoded_prefix = %decoded.chars().take(16).collect::<String>(),
                "auth_bridge: cookie neither UUID nor s:<sid>.<sig>"
            );
        }

        Ok(Self { user_id: None })
    }
}

/// Parse the connect-sid signed cookie format `s:<sid>.<sig>` and return
/// `<sid>`. Returns None if the value is not in that format.
fn parse_express_signed_cookie(value: &str) -> Option<String> {
    let stripped = value.strip_prefix("s:")?;
    // connect-sid uses the LAST dot as the sig separator, but sids generated
    // by uid-safe don't contain dots themselves, so first/last split is
    // equivalent in practice. Use rsplit_once for robustness if Express ever
    // switches sid generators.
    let (sid, _sig) = stripped.rsplit_once('.')?;
    if sid.is_empty() {
        return None;
    }
    Some(sid.to_string())
}

/// Minimal percent-decoding for cookie values. Cookies don't use `+` for
/// space (that's application/x-www-form-urlencoded), so we only decode `%xx`.
fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = hex_nibble(bytes[i + 1]);
            let lo = hex_nibble(bytes[i + 2]);
            if let (Some(h), Some(l)) = (hi, lo) {
                out.push((h << 4) | l);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8(out).unwrap_or_else(|e| {
        // Fall back to lossy conversion; any non-UTF8 byte shouldn't appear
        // in a legitimate connect-sid cookie anyway.
        String::from_utf8_lossy(&e.into_bytes()).into_owned()
    })
}

fn hex_nibble(b: u8) -> Option<u8> {
    match b {
        b'0'..=b'9' => Some(b - b'0'),
        b'a'..=b'f' => Some(b - b'a' + 10),
        b'A'..=b'F' => Some(b - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_express_cookie() {
        let sid = parse_express_signed_cookie(
            "s:z-NeT7KyJ5EncSPMKNBPJQIprIgT8-W3.ppTagh3phM2lFDWse6DQhMlE8eDxWbKF05IcvSI2+o8",
        );
        assert_eq!(sid.as_deref(), Some("z-NeT7KyJ5EncSPMKNBPJQIprIgT8-W3"));
    }

    #[test]
    fn rejects_non_signed_cookie() {
        assert!(parse_express_signed_cookie("plain-uuid-value").is_none());
        assert!(parse_express_signed_cookie("s:").is_none());
        assert!(parse_express_signed_cookie("s:nodot").is_none());
    }

    #[test]
    fn percent_decodes_express_cookie() {
        // Real cookie observed from the browser, URL-encoded on the wire.
        let encoded = "s%3Az-NeT7KyJ5EncSPMKNBPJQIprIgT8-W3.ppTagh3phM2lFDWse6DQhMlE8eDxWbKF05IcvSI2%2Bo8";
        let decoded = percent_decode(encoded);
        assert_eq!(
            decoded,
            "s:z-NeT7KyJ5EncSPMKNBPJQIprIgT8-W3.ppTagh3phM2lFDWse6DQhMlE8eDxWbKF05IcvSI2+o8"
        );
    }
}
