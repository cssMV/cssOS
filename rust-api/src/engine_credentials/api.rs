//! HTTP surface for the BYOK settings panel.
//!
//!   GET    /api/settings/engine-keys              — list user's active keys
//!   POST   /api/settings/engine-keys              — add or replace a key
//!   DELETE /api/settings/engine-keys/:engine      — revoke a key
//!   POST   /api/settings/engine-keys/:engine/test — whoami() round-trip
//!
//! All routes require AuthSession. Response shape is uniform:
//!   { "ok": true, "credential": {..public fields..} }
//!
//! Private fields (plaintext key, raw ciphertext) never leave the server.
//! The frontend displays `key_suffix` + status badge + last_validated_at.

use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use tracing::info;
use uuid::Uuid;

use crate::auth::AuthSession;
use crate::routes::AppState;

use super::store::{self, EngineCredentialRow};
use super::{crypto, master_key_from_config};

pub fn router() -> Router<AppState> {
    Router::new()
        .route(
            "/api/settings/engine-keys",
            get(list_keys).post(upsert_key),
        )
        .route(
            "/api/settings/engine-keys/:engine",
            axum::routing::delete(revoke_key),
        )
        .route(
            "/api/settings/engine-keys/:engine/test",
            post(test_key),
        )
}

// ---------------------------------------------------------------------------
// Public DTO — never includes plaintext or ciphertext.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
struct CredentialView {
    engine_key: String,
    key_suffix: String,
    status: String,
    last_validated_at: Option<String>,
    last_used_at: Option<String>,
    created_at: String,
    updated_at: String,
}

impl From<&EngineCredentialRow> for CredentialView {
    fn from(row: &EngineCredentialRow) -> Self {
        Self {
            engine_key: row.engine_key.clone(),
            key_suffix: row.key_suffix.clone(),
            status: row.status.clone(),
            last_validated_at: row.last_validated_at.map(|t| t.to_rfc3339()),
            last_used_at: row.last_used_at.map(|t| t.to_rfc3339()),
            created_at: row.created_at.to_rfc3339(),
            updated_at: row.updated_at.to_rfc3339(),
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn require_user(auth: &AuthSession) -> Result<Uuid, (StatusCode, Json<serde_json::Value>)> {
    match auth.user_id {
        Some(id) => Ok(id),
        None => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok": false, "error": "sign_in_required"})),
        )),
    }
}

/// Allowed engine slugs. Keep this in sync with `engine_registry::defaults`
/// so we can't accept BYOK entries for engines the registry doesn't know
/// about.
///
/// CSSOS_PHASE2_BYOK_LLM 20260427 #156 — Jing
/// "在 advanced settings 让用户配 BYOK 自己的 OpenAI key（我试了，好像无法
///  保存，请修复）"
/// Added the LLM providers (openai / anthropic / google) so users can
/// supply their own keys when our shared OpenAI quota gets exhausted.
/// The lyrics stage uses `crate::llm::generate_chat` which can route to
/// any of these via the engine field. With BYOK in place the user's own
/// key is preferred and our shared quota is preserved.
///
/// Aliases ("eleven", "stable_audio", etc.) get folded into their canonical
/// slug below so the frontend can be flexible about naming.
const SUPPORTED_ENGINES: &[&str] = &[
    "runway",
    "elevenlabs",
    "stability",
    "suno",
    "openai",
    "anthropic",
    "google",
];

fn engine_slug(raw: &str) -> Option<String> {
    let slug = raw.trim().to_ascii_lowercase();
    // Fold common aliases so the frontend can be flexible.
    let canonical = match slug.as_str() {
        "eleven" | "eleven-music" | "eleven_music" => "elevenlabs",
        "stable-audio" | "stable_audio" | "stableaudio" => "stability",
        "claude" => "anthropic",
        "gemini" | "google-ai" | "google_ai" => "google",
        "gpt" | "gpt-4" | "gpt4" | "openai-gpt" => "openai",
        other => other,
    };
    if SUPPORTED_ENGINES.contains(&canonical) {
        Some(canonical.to_string())
    } else {
        None
    }
}

// ---------------------------------------------------------------------------
// GET /api/settings/engine-keys
// ---------------------------------------------------------------------------

async fn list_keys(
    State(app): State<AppState>,
    auth: AuthSession,
) -> axum::response::Response {
    let user_id = match require_user(&auth) {
        Ok(id) => id,
        Err((code, body)) => return (code, body).into_response(),
    };

    match store::list(&app.pool, user_id).await {
        Ok(rows) => {
            let view: Vec<CredentialView> = rows.iter().map(CredentialView::from).collect();
            (
                StatusCode::OK,
                Json(json!({
                    "ok": true,
                    "credentials": view,
                    "supported_engines": SUPPORTED_ENGINES,
                    "byok_enabled": master_key_from_config(&app.config).is_some(),
                })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(err = ?e, "list engine_credentials failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": "db_error"})),
            )
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/settings/engine-keys
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
struct UpsertRequest {
    engine: String,
    /// Plaintext API key. Scrubbed from logs; encrypted before storage.
    api_key: String,
}

async fn upsert_key(
    State(app): State<AppState>,
    auth: AuthSession,
    Json(body): Json<UpsertRequest>,
) -> axum::response::Response {
    let user_id = match require_user(&auth) {
        Ok(id) => id,
        Err((code, body)) => return (code, body).into_response(),
    };

    let Some(engine) = engine_slug(&body.engine) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({
                "ok": false,
                "error": "unsupported_engine",
                "supported": SUPPORTED_ENGINES,
            })),
        )
            .into_response();
    };

    let trimmed = body.api_key.trim();
    if trimmed.len() < 8 {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "api_key_too_short"})),
        )
            .into_response();
    }

    let Some(master) = master_key_from_config(&app.config) else {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({
                "ok": false,
                "error": "byok_disabled",
                "detail": "server is not configured for BYOK (ENGINE_CRED_MASTER_KEY unset)"
            })),
        )
            .into_response();
    };

    let ct = match crypto::encrypt(&master, trimmed.as_bytes()) {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(err = ?e, "BYOK encrypt failed");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": "encrypt_failed"})),
            )
                .into_response();
        }
    };
    let suffix = crypto::key_suffix(trimmed);

    let row = match store::upsert(&app.pool, user_id, &engine, &ct, &suffix).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(err = ?e, engine = engine, "upsert engine_credentials failed");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": "db_error"})),
            )
                .into_response();
        }
    };

    info!(
        user_id = %user_id,
        engine = engine,
        suffix = suffix,
        "BYOK credential upserted"
    );

    (
        StatusCode::OK,
        Json(json!({
            "ok": true,
            "credential": CredentialView::from(&row),
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/settings/engine-keys/:engine
// ---------------------------------------------------------------------------

async fn revoke_key(
    State(app): State<AppState>,
    auth: AuthSession,
    Path(engine_raw): Path<String>,
) -> axum::response::Response {
    let user_id = match require_user(&auth) {
        Ok(id) => id,
        Err((code, body)) => return (code, body).into_response(),
    };
    let Some(engine) = engine_slug(&engine_raw) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "unsupported_engine"})),
        )
            .into_response();
    };

    match store::revoke(&app.pool, user_id, &engine).await {
        Ok(true) => (
            StatusCode::OK,
            Json(json!({"ok": true, "revoked": true, "engine": engine})),
        )
            .into_response(),
        Ok(false) => (
            StatusCode::NOT_FOUND,
            Json(json!({"ok": false, "error": "no_active_credential"})),
        )
            .into_response(),
        Err(e) => {
            tracing::error!(err = ?e, "revoke engine_credentials failed");
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"ok": false, "error": "db_error"})),
            )
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/settings/engine-keys/:engine/test
// ---------------------------------------------------------------------------
//
// Per-engine whoami dispatch. Runway is implemented today (Task #70 pilot);
// ElevenLabs / Stability / Suno land as part of #71 / #72 / #73 and will
// hook in here without schema changes. The helper returns a JSON blob that
// the UI renders as "Runway · 5,000 credits · valid" underneath the key
// row.

async fn test_key(
    State(app): State<AppState>,
    auth: AuthSession,
    Path(engine_raw): Path<String>,
) -> axum::response::Response {
    let user_id = match require_user(&auth) {
        Ok(id) => id,
        Err((code, body)) => return (code, body).into_response(),
    };
    let Some(engine) = engine_slug(&engine_raw) else {
        return (
            StatusCode::BAD_REQUEST,
            Json(json!({"ok": false, "error": "unsupported_engine"})),
        )
            .into_response();
    };

    let master = match master_key_from_config(&app.config) {
        Some(m) => m,
        None => {
            return (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({
                    "ok": false,
                    "error": "byok_disabled",
                })),
            )
                .into_response();
        }
    };

    let Some(row) = store::get(&app.pool, user_id, &engine)
        .await
        .ok()
        .flatten()
    else {
        return (
            StatusCode::NOT_FOUND,
            Json(json!({"ok": false, "error": "no_active_credential"})),
        )
            .into_response();
    };

    let plaintext = match crypto::decrypt(&master, &row.encrypted_key) {
        Ok(pt) => match String::from_utf8(pt) {
            Ok(s) => s,
            Err(_) => {
                let _ = store::mark_invalid(&app.pool, row.id).await;
                return (
                    StatusCode::UNPROCESSABLE_ENTITY,
                    Json(json!({"ok": false, "error": "corrupt_credential"})),
                )
                    .into_response();
            }
        },
        Err(e) => {
            tracing::warn!(err = ?e, "BYOK decrypt failed during test");
            let _ = store::mark_invalid(&app.pool, row.id).await;
            return (
                StatusCode::UNPROCESSABLE_ENTITY,
                Json(json!({"ok": false, "error": "corrupt_credential"})),
            )
                .into_response();
        }
    };

    match engine.as_str() {
        "runway" => match test_runway(&plaintext).await {
            Ok(detail) => {
                let _ = store::mark_validated(&app.pool, row.id).await;
                (
                    StatusCode::OK,
                    Json(json!({
                        "ok": true,
                        "engine": "runway",
                        "detail": detail,
                    })),
                )
                    .into_response()
            }
            Err(msg) => {
                let _ = store::mark_invalid(&app.pool, row.id).await;
                (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "ok": false,
                        "error": "whoami_failed",
                        "engine": "runway",
                        "detail": msg,
                    })),
                )
                    .into_response()
            }
        },
        // CSSOS_PHASE2_BYOK 20260420 — Task #71: ElevenLabs whoami hits
        // `GET /v1/user` and surfaces character_balance + tier so the UI
        // can render "ElevenLabs · 42,318 / 100,000 chars · creator".
        "elevenlabs" => match test_elevenlabs(&plaintext).await {
            Ok(detail) => {
                let _ = store::mark_validated(&app.pool, row.id).await;
                (
                    StatusCode::OK,
                    Json(json!({
                        "ok": true,
                        "engine": "elevenlabs",
                        "detail": detail,
                    })),
                )
                    .into_response()
            }
            Err(msg) => {
                let _ = store::mark_invalid(&app.pool, row.id).await;
                (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "ok": false,
                        "error": "whoami_failed",
                        "engine": "elevenlabs",
                        "detail": msg,
                    })),
                )
                    .into_response()
            }
        },
        // CSSOS_PHASE2_BYOK 20260420 — Task #72: Stability whoami hits
        // `GET /v1/user/account` + `/v1/user/balance` so the UI can render
        // "Stability · 12,345 credits · acme-org".
        "stability" => match test_stability(&plaintext).await {
            Ok(detail) => {
                let _ = store::mark_validated(&app.pool, row.id).await;
                (
                    StatusCode::OK,
                    Json(json!({
                        "ok": true,
                        "engine": "stability",
                        "detail": detail,
                    })),
                )
                    .into_response()
            }
            Err(msg) => {
                let _ = store::mark_invalid(&app.pool, row.id).await;
                (
                    StatusCode::BAD_GATEWAY,
                    Json(json!({
                        "ok": false,
                        "error": "whoami_failed",
                        "engine": "stability",
                        "detail": msg,
                    })),
                )
                    .into_response()
            }
        },
        _ => (
            StatusCode::NOT_IMPLEMENTED,
            Json(json!({
                "ok": false,
                "error": "whoami_not_supported_yet",
                "engine": engine,
                "detail": "test endpoint for this engine lands with its BYOK rollout"
            })),
        )
            .into_response(),
    }
}

async fn test_runway(plaintext: &str) -> Result<serde_json::Value, String> {
    use crate::video::backend::runway::{RunwayClient, RunwayConfig};
    let cfg = RunwayConfig::with_api_key(plaintext.to_string());
    let client = RunwayClient::new(cfg).map_err(|e| e.to_string())?;
    let info = client.whoami().await.map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(&info).unwrap_or_else(|_| json!({})))
}

async fn test_elevenlabs(plaintext: &str) -> Result<serde_json::Value, String> {
    use crate::music_gen::{ElevenMusicClient, ElevenMusicConfig};
    let cfg = ElevenMusicConfig::with_api_key(plaintext.to_string());
    let client = ElevenMusicClient::new(cfg).map_err(|e| e.to_string())?;
    let info = client.whoami().await.map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(&info).unwrap_or_else(|_| json!({})))
}

/// CSSOS_PHASE2_BYOK 20260420 — Task #72: Stability whoami helper.
/// Uses the Stable Audio client because it already owns the bearer-auth
/// reqwest::Client wiring; the underlying v1 account/balance endpoints
/// are shared across every Stability product (SDXL, Stable Audio, etc.),
/// so whoami doubles as a test for the cover engine too.
async fn test_stability(plaintext: &str) -> Result<serde_json::Value, String> {
    use crate::music_gen::{StableAudioClient, StableAudioConfig};
    let cfg = StableAudioConfig::with_api_key(plaintext.to_string());
    let client = StableAudioClient::new(cfg).map_err(|e| e.to_string())?;
    let info = client.whoami().await.map_err(|e| e.to_string())?;
    Ok(serde_json::to_value(&info).unwrap_or_else(|_| json!({})))
}
