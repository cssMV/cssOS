// CSSOS_PHASE2_MV_API 20260417 — browser-orchestrated MV pipeline surface.
//
// Each stage is a standalone axum handler the frontend calls in sequence:
//   POST /api/mv/cover   → Runway text_to_image
//   POST /api/mv/music   → MusicGPT MusicAI
//   POST /api/mv/video   → Runway image_to_video
//   POST /api/mv/compose → ffmpeg mux (audio + video [+ srt]) → mp4
//   POST /api/mv/commit  → persist finished MV as a user_work with cost meta
//
// Each successful 3P call meters the caller against their billing account via
// `billing::meter_usage`. Billing price per engine is resolved from
// `billing_matrix::default_price_rule` so ops can tune without code changes
// beyond editing the rule table.
//
// Auth: the caller MUST be signed in (AuthSession.user_id). Anonymous callers
// get 401 — we don't want to mystery-bill the demo account for paid 3P work.

use std::collections::HashMap;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::auth::AuthSession;
use crate::billing::meter_usage;
use crate::billing_matrix::{
    classify_tier_by_seconds, default_price_rule, engine_registry, engines_for_stage, mv_tiers,
    EngineCatalogEntry, MvTier,
};
use crate::engine_credentials::{self, ResolvedKey};
use crate::llm::{generate_chat, ChatRequest};
use crate::music_gen::{
    ElevenMusicClient, ElevenMusicConfig, MusicGenError, MusicGenRequest, MusicGenResult,
    MusicGptClient, StableAudioClient, StableAudioConfig, SunoClient,
};
use crate::mv_compose::{compose_mv, ComposeRequest};
use crate::mv_random_inputs;
use crate::routes::AppState;
use crate::video::backend::runway::{
    RunwayClient, RunwayConfig, RunwayError, RunwayImageRequest, RunwayVideoRequest,
};

pub fn router() -> Router<AppState> {
    // CSSOS_PHASE2_COVER_WEBP_SERVE 20260425 #115 — Jing
    // Serve transcoded cover WebPs via /api/cover-webp/<filename>. We
    // mount tower_http's ServeDir at the same dir cover_webp.rs writes
    // to so the URL it returns to the frontend is reachable through the
    // existing nginx → /api/* → :8081 proxy. No nginx change needed.
    let cover_dir = std::env::var("COVER_WEBP_OUTPUT_DIR")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| crate::cover_webp::DEFAULT_OUTPUT_DIR.to_string());
    let cover_serve = tower_http::services::ServeDir::new(&cover_dir)
        .append_index_html_on_directories(false);
    Router::new()
        .route("/api/mv/cover", post(cover))
        .route("/api/mv/lyrics", post(lyrics))
        .route("/api/mv/music", post(music))
        .route("/api/mv/video", post(video))
        .route("/api/mv/subtitles", post(subtitles))
        .route("/api/mv/compose", post(compose))
        .route("/api/mv/commit", post(commit))
        .route("/api/mv/engines", get(engines_catalog))
        .route("/api/mv/tiers", get(tiers_catalog))
        .nest_service("/api/cover-webp", cover_serve)
}

fn price_cents(engine: &str, version: &str) -> i64 {
    // billing_matrix prices are in USD f64; convert to integer cents and round
    // up so we never undercharge the caller by a fraction.
    let rule = default_price_rule(engine, version);
    (rule.base_price_usd * 100.0).ceil() as i64
}

/// CSSOS_PHASE2_BYOK 20260420 — orchestration fee (in cents) charged when the
/// user brings their own third-party key. This covers our compute / pipeline
/// plumbing but zeroes the upstream API cost (that cost is now the user's
/// problem, paid directly to Runway / ElevenLabs / etc.). Controlled by an
/// env var so ops can tune it per-environment without a redeploy.
fn byok_orchestration_cents() -> i64 {
    std::env::var("BYOK_ORCHESTRATION_CENTS")
        .ok()
        .and_then(|v| v.parse::<i64>().ok())
        .unwrap_or(0)
}

/// CSSOS_PHASE2_BYOK 20260420 — build a RunwayClient for this user. Checks
/// `engine_credentials` first; falls back to the platform env key.
///
/// Returns `(client, use_user_key, row_id_if_any)` so the caller can:
///   - stamp `last_used_at` on the credential row after a successful request
///   - bill `byok_orchestration_cents()` instead of the full engine price
///   - surface a descriptive error ("add your Runway key in Settings") when
///     neither the user nor the platform has a key configured
async fn resolve_runway_client(
    app: &AppState,
    user_id: Uuid,
) -> Result<(RunwayClient, bool, Option<Uuid>), (StatusCode, Json<serde_json::Value>)> {
    let master = engine_credentials::master_key_from_config(&app.config);
    let resolved = engine_credentials::resolve_engine_key(
        &app.pool,
        master.as_ref(),
        user_id,
        "runway",
        Some("RUNWAY_API_KEY"),
    )
    .await;

    match resolved {
        ResolvedKey::User { plaintext, row_id } => {
            let cfg = RunwayConfig::with_api_key(plaintext);
            let client = RunwayClient::new(cfg).map_err(upstream_not_configured)?;
            Ok((client, true, Some(row_id)))
        }
        ResolvedKey::Platform { plaintext } => {
            let cfg = RunwayConfig::with_api_key(plaintext);
            let client = RunwayClient::new(cfg).map_err(upstream_not_configured)?;
            Ok((client, false, None))
        }
        ResolvedKey::NotConfigured => Err(upstream_not_configured(RunwayError::NotConfigured)),
    }
}

/// CSSOS_PHASE2_BYOK 20260420 — Task #71 build an ElevenMusicClient for this
/// user, mirroring `resolve_runway_client`. Checks `engine_credentials` first
/// under the `elevenlabs` engine slug; falls back to the platform env key
/// (`ELEVEN_API_KEY` / `ELEVENLABS_API_KEY`).
///
/// Returns `(client, use_user_key, row_id_if_any)` so the caller can:
///   - stamp `last_used_at` on the credential row after a successful request
///   - bill `byok_orchestration_cents()` instead of the full engine price
///   - surface a clean "ElevenLabs not configured" error when neither the
///     user nor the platform has a key on file.
async fn resolve_elevenlabs_client(
    app: &AppState,
    user_id: Uuid,
) -> Result<(ElevenMusicClient, bool, Option<Uuid>), (StatusCode, Json<serde_json::Value>)> {
    let master = engine_credentials::master_key_from_config(&app.config);
    // Prefer canonical ELEVEN_API_KEY, but accept ELEVENLABS_API_KEY as an
    // alias so ops can keep existing env naming. `resolve_engine_key`
    // already checks BYOK first; when it reports NotConfigured (no BYOK
    // row, no ELEVEN_API_KEY), we do one last manual ENV check for the
    // alias before giving up — skipping a redundant BYOK DB hit.
    let resolved = engine_credentials::resolve_engine_key(
        &app.pool,
        master.as_ref(),
        user_id,
        "elevenlabs",
        Some("ELEVEN_API_KEY"),
    )
    .await;

    let resolved = match resolved {
        ResolvedKey::NotConfigured => {
            match std::env::var("ELEVENLABS_API_KEY").ok() {
                Some(v) if !v.trim().is_empty() => {
                    ResolvedKey::Platform { plaintext: v.trim().to_string() }
                }
                _ => ResolvedKey::NotConfigured,
            }
        }
        other => other,
    };

    match resolved {
        ResolvedKey::User { plaintext, row_id } => {
            let cfg = ElevenMusicConfig::with_api_key(plaintext);
            let client = ElevenMusicClient::new(cfg).map_err(upstream_not_configured)?;
            Ok((client, true, Some(row_id)))
        }
        ResolvedKey::Platform { plaintext } => {
            let cfg = ElevenMusicConfig::with_api_key(plaintext);
            let client = ElevenMusicClient::new(cfg).map_err(upstream_not_configured)?;
            Ok((client, false, None))
        }
        ResolvedKey::NotConfigured => {
            Err(upstream_not_configured(MusicGenError::NotConfigured {
                engine: "ElevenLabs Music",
                env_var: "ELEVEN_API_KEY",
            }))
        }
    }
}

/// CSSOS_PHASE2_BYOK 20260420 — Task #72: per-user Stability client resolver.
/// Exact parallel of the Runway + ElevenLabs helpers. The only wrinkle is that
/// Stability uses one key across two services (SDXL cover + Stable Audio 2),
/// so the canonical env var is just `STABILITY_API_KEY`. We deliberately do
/// not introduce an alias here — there's only one platform-level key to try.
async fn resolve_stability_client(
    app: &AppState,
    user_id: Uuid,
) -> Result<(StableAudioClient, bool, Option<Uuid>), (StatusCode, Json<serde_json::Value>)> {
    let master = engine_credentials::master_key_from_config(&app.config);
    let resolved = engine_credentials::resolve_engine_key(
        &app.pool,
        master.as_ref(),
        user_id,
        "stability",
        Some("STABILITY_API_KEY"),
    )
    .await;

    match resolved {
        ResolvedKey::User { plaintext, row_id } => {
            let cfg = StableAudioConfig::with_api_key(plaintext);
            let client = StableAudioClient::new(cfg).map_err(upstream_not_configured)?;
            Ok((client, true, Some(row_id)))
        }
        ResolvedKey::Platform { plaintext } => {
            let cfg = StableAudioConfig::with_api_key(plaintext);
            let client = StableAudioClient::new(cfg).map_err(upstream_not_configured)?;
            Ok((client, false, None))
        }
        ResolvedKey::NotConfigured => {
            Err(upstream_not_configured(MusicGenError::NotConfigured {
                engine: "Stable Audio",
                env_var: "STABILITY_API_KEY",
            }))
        }
    }
}

fn meta_json(extra: serde_json::Value) -> serde_json::Value {
    let mut obj = serde_json::Map::new();
    obj.insert("source".into(), json!("mv_pipeline"));
    obj.insert("phase".into(), json!("phase2"));
    if let serde_json::Value::Object(m) = extra {
        for (k, v) in m {
            obj.insert(k, v);
        }
    }
    serde_json::Value::Object(obj)
}

async fn require_user(auth: &AuthSession) -> Result<Uuid, (StatusCode, Json<serde_json::Value>)> {
    match auth.user_id {
        Some(id) => Ok(id),
        None => Err((
            StatusCode::UNAUTHORIZED,
            Json(json!({"ok": false, "error": "sign_in_required"})),
        )),
    }
}

// ---------------------------------------------------------------- /mv/cover

#[derive(Debug, Deserialize)]
pub struct CoverRequest {
    #[serde(default)]
    pub prompt: String,
    #[serde(default)]
    pub ratio: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    // CSSOS_PHASE2_P2_58 20260419 — optional UI locale so the random-prompt
    // bank can pick a matching-locale fallback when `prompt` is empty.
    #[serde(default)]
    pub language: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CoverResponse {
    pub ok: bool,
    pub task_id: String,
    pub image_url: String,
    pub model: String,
    pub engine: &'static str,
    pub version: &'static str,
    pub cost_cents: i64,
    // CSSOS_PHASE2_BYOK 20260420 — true when the caller's own Runway key
    // was used; frontend renders a "Your Runway key" pill + the reduced
    // cost_cents so the user can see they saved the full engine price.
    #[serde(default)]
    pub use_user_key: bool,
}

// CSSOS_PHASE2_MV_KEEPALIVE 20260425 #112 — see music() for rationale.
// Cover generation (Runway text_to_image) usually returns within 10–30s
// but the +PNG→WebP transcode can push it past nginx's 60s timeout for
// big sources. Wrap it for safety.
async fn cover(
    State(app): State<AppState>,
    auth: AuthSession,
    Json(body): Json<CoverRequest>,
) -> axum::response::Response {
    crate::mv_keepalive::keepalive_json(
        async move { cover_inner(app, auth, body).await },
        std::time::Duration::from_secs(30),
    )
    .await
}

async fn cover_inner(
    app: AppState,
    auth: AuthSession,
    body: CoverRequest,
) -> Result<Json<CoverResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = require_user(&auth).await?;
    let (client, use_user_key, byok_row_id) = resolve_runway_client(&app, user_id).await?;
    // CSSOS_PHASE2_P2_58 20260419 — 凡是需要输入的选项都要有随机兜底.
    // Empty prompt ⇒ pick a locale-appropriate evocative prompt from the
    // server-side bank so Runway text_to_image never sees `prompt: ""`.
    let resolved_prompt = mv_random_inputs::ensure_prompt(
        &body.prompt,
        body.language.as_deref(),
    );
    let asset = client
        .text_to_image(&RunwayImageRequest {
            prompt: resolved_prompt.clone(),
            ratio: body.ratio,
            model: body.model,
            seed: None,
        })
        .await
        .map_err(upstream_error)?;

    // CSSOS_PHASE2_COVER_WEBP 20260425 #105 — Jing
    // ("封面图请不要再输出 png 格式，占用空间大，显示速度也慢，应该也必须
    //   输出 webp 格式，体积小，显示快"). Runway returns a CDN-hosted PNG
    // (e.g. 4–6 MB at 1024²). Transcode it to a locally-served WebP so
    // the frontend painter and the cover slideshow ship 30–60 % less
    // bytes for the SAME visual quality. On any failure we fall back to
    // the original URL so the user never sees a blank cover.
    let optimized_url = crate::cover_webp::maybe_transcode_cover_to_webp(&asset.output_url).await;

    let engine = "runway";
    let version = "gen4-image";
    // CSSOS_PHASE2_BYOK 20260420 — with a user-supplied key, CSS Studio
    // doesn't pay Runway for this call, so we only charge the orchestration
    // fee (0 by default; operators can set BYOK_ORCHESTRATION_CENTS to opt
    // in to a platform margin). Platform keys bill at full price as before.
    let cost_cents = if use_user_key {
        byok_orchestration_cents()
    } else {
        price_cents(engine, version)
    };
    if let Some(id) = byok_row_id {
        let _ = engine_credentials::store::mark_used(&app.pool, id).await;
    }
    let _ = meter_usage(
        &app.pool,
        user_id,
        "/api/mv/cover",
        1,
        cost_cents,
        Some(asset.task_id.clone()),
        meta_json(json!({
            "engine": engine,
            "version": version,
            "model": asset.model,
            "prompt": resolved_prompt,
            "use_user_key": use_user_key,
        })),
    )
    .await;

    Ok(Json(CoverResponse {
        ok: true,
        task_id: asset.task_id,
        image_url: optimized_url,
        model: asset.model,
        engine,
        version,
        cost_cents,
        use_user_key,
    }))
}

// ---------------------------------------------------------------- /mv/music

#[derive(Debug, Deserialize)]
pub struct MusicRequest {
    // CSSOS_PHASE2_P2_58 20260419 — `prompt` is no longer required at the
    // deserialise layer. Empty / missing prompts get a random-bank fallback
    // below so the upstream never sees an empty string (which it rejects with
    // "must have input"). Same for music_style and lyrics.
    #[serde(default)]
    pub prompt: String,
    #[serde(default)]
    pub music_style: Option<String>,
    #[serde(default)]
    pub lyrics: Option<String>,
    #[serde(default)]
    pub make_instrumental: bool,
    #[serde(default)]
    pub voice_id: Option<String>,
    #[serde(default)]
    pub language: Option<String>,
    // CSSOS_PHASE2_SUNO 20260419 — caller-selected engine/version. The
    // frontend `withEngine(stageId, body)` helper attaches these from the
    // user's catalog selection (see app.mv-engines-catalog.js). Absent ⇒ we
    // resolve the default from env (Suno preferred, MusicGPT fallback).
    #[serde(default)]
    pub engine: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct MusicResponse {
    pub ok: bool,
    pub task_id: String,
    pub conversion_id: Option<String>,
    pub audio_url: String,
    pub format: String,
    pub duration_secs: Option<f64>,
    pub title: Option<String>,
    // CSSOS_PHASE2_SUNO 20260419 — engine/version are now resolved at runtime
    // (Suno vs. MusicGPT vs. any future provider), so they're owned strings
    // rather than &'static str literals.
    pub engine: String,
    pub version: String,
    pub cost_cents: i64,
    // CSSOS_PHASE2_BYOK 20260420 — Task #71 true when the caller's own
    // ElevenLabs (or future BYOK-capable music engine) key was used;
    // frontend renders a "Your ElevenLabs key" pill + the reduced cost so
    // the user can see the savings.
    #[serde(default)]
    pub use_user_key: bool,
    // CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
    // "音乐引擎渲染音乐的时候，是否正确并且同时输出带有时间戳的歌词时间轴
    //  json？不然字幕无法渲染。" — Suno + ElevenLabs both expose per-line
    // timestamps in their result payloads; we now propagate them through so
    // /api/mv/subtitles can build SRT from real timing instead of even-divide.
    // Always-present-in-JSON (null when engine doesn't emit alignment) so the
    // frontend has a uniform check.
    #[serde(default)]
    pub aligned_lyrics: Option<Vec<crate::music_gen::AlignedLyricLine>>,
}

/// CSSOS_PHASE2_P2_87_NO_MUSICGPT_DEFAULT 20260424 — shared runtime-readiness
/// check used by both `resolve_music_engine` (auto-resolve) and the
/// `/api/mv/engines` catalog (default_engine hint). Keeps the readiness
/// rules in one place so env-var names stay in sync.
fn is_music_engine_ready(engine: &str) -> bool {
    fn env_non_empty(name: &str) -> bool {
        std::env::var(name)
            .map(|k| !k.trim().is_empty())
            .unwrap_or(false)
    }
    match engine {
        "suno" => env_non_empty("SUNO_API_KEY"),
        "elevenlabs" | "eleven" | "eleven-music" => {
            env_non_empty("ELEVEN_API_KEY") || env_non_empty("ELEVENLABS_API_KEY")
        }
        "stability" | "stable-audio" | "stable_audio" => env_non_empty("STABILITY_API_KEY"),
        "musicgpt" => env_non_empty("MUSICGPT_API_KEY"),
        _ => false,
    }
}

/// Resolve which music engine + version to use for this call and which
/// upstream client to instantiate.
///
/// CSSOS_PHASE2_P2_87_NO_MUSICGPT_DEFAULT 20260424 — Jing reports that even
/// when the UI's advanced panel selects a non-MusicGPT engine, every call
/// ends up hitting MusicGPT. Two changes to make the dispatch predictable:
///
///   1. An EXPLICIT engine request always wins — even if the matching API
///      key is not configured. We return that engine label and let the
///      adapter return NotConfigured → 503 so the user sees "your selection
///      isn't set up" instead of a silent swap to a different provider.
///   2. MusicGPT is removed from the auto-resolve chain entirely. It is now
///      opt-in-only (engine="musicgpt" in the request body). Auto order is
///      Suno → ElevenLabs → Stability. If none of those three are ready we
///      still return "suno" so the downstream adapter emits a clean
///      NotConfigured error rather than falling through to MusicGPT, which
///      has repeatedly produced pydantic-422 "Bad Request" responses.
fn resolve_music_engine(body: &MusicRequest) -> (String, String) {
    let requested_engine = body
        .engine
        .as_deref()
        .map(|s| s.trim().to_ascii_lowercase())
        .filter(|s| !s.is_empty());
    let requested_version = body
        .version
        .as_deref()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty());

    // CSSOS_PHASE2_P2_87_NO_MUSICGPT_DEFAULT 20260424 — honour the explicit
    // engine choice ALWAYS. We no longer silently fall through to
    // auto-resolve when the chosen engine's API key is missing; that
    // behaviour was the root cause of "I picked Stability but it still
    // ran MusicGPT". The adapter layer will return a NotConfigured error
    // if the key is missing, which the handler maps to a clean 503.
    if let Some(engine) = requested_engine.as_deref() {
        match engine {
            "suno" => {
                return (
                    "suno".into(),
                    requested_version.unwrap_or_else(|| "v5".into()),
                );
            }
            "musicgpt" => {
                return (
                    "musicgpt".into(),
                    requested_version.unwrap_or_else(|| "v1.0".into()),
                );
            }
            "elevenlabs" | "eleven" | "eleven-music" => {
                return (
                    "elevenlabs".into(),
                    requested_version.unwrap_or_else(|| "v1".into()),
                );
            }
            "stability" | "stable-audio" | "stable_audio" => {
                return (
                    "stability".into(),
                    requested_version.unwrap_or_else(|| "2.0".into()),
                );
            }
            _ => {
                // Genuinely unknown engine name (typo, hot-swapped catalog):
                // fall through to auto-resolve rather than hard-failing.
            }
        }
    }

    // CSSOS_PHASE2_P2_87_NO_MUSICGPT_DEFAULT 20260424 — MusicGPT intentionally
    // excluded from the auto-resolve chain. It is opt-in only.
    if is_music_engine_ready("suno") {
        ("suno".into(), "v5".into())
    } else if is_music_engine_ready("elevenlabs") {
        ("elevenlabs".into(), "v1".into())
    } else if is_music_engine_ready("stability") {
        ("stability".into(), "2.0".into())
    } else {
        // No non-MusicGPT engine is configured. Return "suno" so the adapter
        // returns a clean NotConfigured → 503 rather than silently falling
        // through to MusicGPT's unreliable adapter.
        ("suno".into(), "v5".into())
    }
}

/// CSSOS_PHASE2_BYOK 20260420 — Task #71 return shape now carries BYOK info so
/// the caller can fork cost + stamp last_used_at + render the "Your key" pill.
/// Non-BYOK engines (suno, stability, musicgpt) hard-code `use_user_key=false`
/// until their own BYOK rollout (Task #72 / #73 / #74).
struct MusicRunOutcome {
    result: MusicGenResult,
    use_user_key: bool,
    byok_row_id: Option<Uuid>,
}

async fn run_music_generation(
    app: &AppState,
    user_id: Uuid,
    engine: &str,
    req: &MusicGenRequest,
) -> Result<MusicRunOutcome, (StatusCode, Json<serde_json::Value>)> {
    match engine {
        "suno" => {
            let result = SunoClient::from_env()
                .map_err(music_err_map)?
                .generate(req)
                .await
                .map_err(music_err_map)?;
            Ok(MusicRunOutcome {
                result,
                use_user_key: false,
                byok_row_id: None,
            })
        }
        // CSSOS_PHASE2_BYOK 20260420 — Task #71: ElevenLabs now resolves
        // the per-user key first, falling back to the platform env. Cost
        // fork + last_used_at stamping happens in the caller.
        "elevenlabs" | "eleven" | "eleven-music" => {
            let (client, use_user_key, byok_row_id) =
                resolve_elevenlabs_client(app, user_id).await?;
            let result = client.generate(req).await.map_err(music_err_map)?;
            Ok(MusicRunOutcome {
                result,
                use_user_key,
                byok_row_id,
            })
        }
        // CSSOS_PHASE2_BYOK 20260420 — Task #72: Stability now resolves
        // the per-user key first (engine_credentials → STABILITY_API_KEY),
        // falling back to the platform env. Cost fork + last_used_at
        // stamping happens in the caller.
        "stability" | "stable-audio" | "stable_audio" => {
            let (client, use_user_key, byok_row_id) =
                resolve_stability_client(app, user_id).await?;
            let result = client.generate(req).await.map_err(music_err_map)?;
            Ok(MusicRunOutcome {
                result,
                use_user_key,
                byok_row_id,
            })
        }
        // Explicitly named MusicGPT still routes there; anything else
        // silently falls through to Suno v5 per Jing 2026-04-19:
        // "后端默默 fall through 到 MusicGPT。请 fall through 到 Suno，优先用 V5".
        // Suno is our preferred default and fails fast (NotConfigured) if
        // the key is missing, which is the same 503 shape MusicGPT used
        // to produce — callers see identical error behaviour, just with
        // the better default engine.
        "musicgpt" => {
            let result = MusicGptClient::from_env()
                .map_err(music_err_map)?
                .generate(req)
                .await
                .map_err(music_err_map)?;
            Ok(MusicRunOutcome {
                result,
                use_user_key: false,
                byok_row_id: None,
            })
        }
        _ => {
            let result = SunoClient::from_env()
                .map_err(music_err_map)?
                .generate(req)
                .await
                .map_err(music_err_map)?;
            Ok(MusicRunOutcome {
                result,
                use_user_key: false,
                byok_row_id: None,
            })
        }
    }
}

fn music_err_map(e: MusicGenError) -> (StatusCode, Json<serde_json::Value>) {
    // CSSOS_PHASE2_MUSICGPT_ERR_VARIANT_TRACE 20260425 #95 —
    // Log the discriminant + Display string of every MusicGenError reaching
    // the API boundary so we can tell at a glance whether the 502 came from
    // Transport (reqwest/network), Upstream (non-2xx with body), MissingField
    // (good 2xx but missing task_id), Timeout (poll loop exhausted) or JobFailed.
    // submit()'s own error log only fires on Upstream; other variants go silent.
    let variant = match &e {
        MusicGenError::NotConfigured { .. } => "NotConfigured",
        MusicGenError::Transport(_) => "Transport",
        MusicGenError::Upstream { .. } => "Upstream",
        MusicGenError::MissingField(_) => "MissingField",
        MusicGenError::Timeout(_) => "Timeout",
        MusicGenError::JobFailed(_) => "JobFailed",
    };
    tracing::error!(
        target: "cssos::mv::music",
        error_variant = variant,
        error_detail = %e,
        "music: dispatch returning error to client"
    );
    if matches!(&e, MusicGenError::NotConfigured { .. }) {
        upstream_not_configured(e)
    } else {
        upstream_error(e)
    }
}

// CSSOS_PHASE2_MV_KEEPALIVE 20260425 #112 — Jing
// /api/mv/music can block for many minutes while MusicGPT generates
// audio. nginx's default proxy_read_timeout (60s) was firing 504 from
// nginx's own page back to the browser ("504 Gateway Time-out"). The
// fix wraps the actual work in a chunked-stream response that emits
// a single space byte every 30s as a keep-alive, plus the final JSON
// at the end. Status code is forced to 200 OK because the body is
// streamed; failure cases land in the body as `{ok: false, ...}`.
async fn music(
    State(app): State<AppState>,
    auth: AuthSession,
    Json(body): Json<MusicRequest>,
) -> axum::response::Response {
    crate::mv_keepalive::keepalive_json(
        async move { music_inner(app, auth, body).await },
        std::time::Duration::from_secs(30),
    )
    .await
}

async fn music_inner(
    app: AppState,
    auth: AuthSession,
    body: MusicRequest,
) -> Result<Json<MusicResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = require_user(&auth).await?;

    // CSSOS_PHASE2_SUNO 20260419 — resolve engine before any I/O so the same
    // engine label appears in both billing meta + response. The catalog
    // default is Suno; callers can override via the `engine` field the
    // frontend's `withEngine()` helper attaches from the user's selection.
    let (engine, version) = resolve_music_engine(&body);
    // CSSOS_PHASE2_P2_87_NO_MUSICGPT_DEFAULT 20260424 — surface the engine
    // decision in the log so we can trace every "stuck on MusicGPT" report
    // back to (a) what the frontend requested and (b) what we resolved to.
    tracing::info!(
        target: "cssos::mv::music",
        requested_engine = ?body.engine,
        requested_version = ?body.version,
        resolved_engine = %engine,
        resolved_version = %version,
        "music: engine dispatch decided"
    );

    // CSSOS_PHASE2_P2_58 20260419 — 凡是需要输入的选项都要随机兜底.
    // Both Suno and MusicGPT reject empty `prompt`. The frontend already
    // synthesises a random seed in most flows, but voice entry, retries, and
    // partial LLM failures can still reach us with empty fields. Fill from
    // the server-side bank before the upstream call.
    let lang = body.language.as_deref();
    let resolved_prompt = mv_random_inputs::ensure_prompt(&body.prompt, lang);
    let resolved_style = mv_random_inputs::ensure_style(body.music_style.as_deref());
    // Only auto-fill lyrics when the caller is explicitly NOT requesting an
    // instrumental track. Instrumental mode is a legit user choice; we must
    // not silently inject lyrics that would force a vocal track.
    let resolved_lyrics = if body.make_instrumental {
        body.lyrics.clone().unwrap_or_default()
    } else {
        mv_random_inputs::ensure_lyrics(body.lyrics.as_deref(), lang)
    };
    let lyrics_for_upstream = if resolved_lyrics.trim().is_empty() {
        None
    } else {
        Some(resolved_lyrics.clone())
    };

    let outcome = run_music_generation(
        &app,
        user_id,
        &engine,
        &MusicGenRequest {
            prompt: resolved_prompt.clone(),
            music_style: Some(resolved_style.clone()),
            lyrics: lyrics_for_upstream,
            make_instrumental: body.make_instrumental,
            voice_id: body.voice_id.clone(),
            // CSSOS_PHASE2_MUSIC_VERSIONING 20260419 — pass the resolved
            // version through so per-provider adapters can route to the
            // matching model (Suno v4 vs v5, Stable Audio 2.0 vs 2.1, etc.).
            version: Some(version.clone()),
        },
    )
    .await?;

    let MusicRunOutcome {
        result,
        use_user_key,
        byok_row_id,
    } = outcome;

    // CSSOS_PHASE2_BYOK 20260420 — Task #71: when the user's own ElevenLabs /
    // future-BYOK key was used, zero the engine cost (they paid upstream
    // directly) and charge only the configured orchestration fee.
    let cost_cents = if use_user_key {
        byok_orchestration_cents()
    } else {
        price_cents(&engine, &version)
    };
    if let Some(id) = byok_row_id {
        let _ = engine_credentials::store::mark_used(&app.pool, id).await;
    }
    let _ = meter_usage(
        &app.pool,
        user_id,
        "/api/mv/music",
        1,
        cost_cents,
        Some(result.task_id.clone()),
        meta_json(json!({
            "engine": engine,
            "version": version,
            "requested_engine": body.engine,
            "requested_version": body.version,
            "prompt": resolved_prompt,
            "style": resolved_style,
            "instrumental": body.make_instrumental,
            "duration_secs": result.duration_secs,
            "conversion_id": result.conversion_id,
            // CSSOS_PHASE2_P2_58 20260419 — audit visibility: did we fall back?
            "prompt_random_filled": body.prompt.trim().is_empty(),
            "style_random_filled": body
                .music_style
                .as_deref()
                .map(|s| s.trim().is_empty())
                .unwrap_or(true),
            "lyrics_random_filled": !body.make_instrumental
                && body
                    .lyrics
                    .as_deref()
                    .map(|s| s.trim().is_empty())
                    .unwrap_or(true),
            "language": body.language,
            // CSSOS_PHASE2_BYOK 20260420 — Task #71 usage-event visibility.
            "use_user_key": use_user_key,
        })),
    )
    .await;

    // CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
    // Propagate per-line timing extracted by the music adapter through to
    // the HTTP response so the frontend can pass it into /api/mv/subtitles.
    // Log a one-line breadcrumb so we can confirm in production whether
    // each engine actually emitted alignment data.
    if let Some(ref lines) = result.aligned_lyrics {
        tracing::info!(
            target = "mv_pipeline_music",
            engine = %engine,
            version = %version,
            line_count = lines.len(),
            "music engine emitted aligned_lyrics — subtitles will use real timing"
        );
    } else {
        tracing::info!(
            target = "mv_pipeline_music",
            engine = %engine,
            version = %version,
            "music engine returned no aligned_lyrics — subtitles will fall back to even-divide"
        );
    }

    Ok(Json(MusicResponse {
        ok: true,
        task_id: result.task_id,
        conversion_id: result.conversion_id,
        audio_url: result.audio_url,
        format: result.format,
        duration_secs: result.duration_secs,
        title: result.title,
        engine,
        version,
        cost_cents,
        use_user_key,
        aligned_lyrics: result.aligned_lyrics,
    }))
}

// ---------------------------------------------------------------- /mv/video

#[derive(Debug, Deserialize)]
pub struct VideoRequest {
    pub prompt_image_url: String,
    #[serde(default)]
    pub prompt_text: Option<String>,
    #[serde(default)]
    pub ratio: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub duration_secs: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct VideoResponse {
    pub ok: bool,
    pub task_id: String,
    pub video_url: String,
    pub model: String,
    pub engine: &'static str,
    pub version: &'static str,
    pub cost_cents: i64,
    // CSSOS_PHASE2_BYOK 20260420 — see CoverResponse.use_user_key.
    #[serde(default)]
    pub use_user_key: bool,
}

// CSSOS_PHASE2_MV_KEEPALIVE 20260425 #112 — Runway image_to_video can
// take 1–3 minutes per shot. Wrap with keepalive heartbeat.
async fn video(
    State(app): State<AppState>,
    auth: AuthSession,
    Json(body): Json<VideoRequest>,
) -> axum::response::Response {
    crate::mv_keepalive::keepalive_json(
        async move { video_inner(app, auth, body).await },
        std::time::Duration::from_secs(30),
    )
    .await
}

async fn video_inner(
    app: AppState,
    auth: AuthSession,
    body: VideoRequest,
) -> Result<Json<VideoResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = require_user(&auth).await?;
    // CSSOS_PHASE2_VIDEO_URL_VALIDATE 20260426 #122 — Jing
    // Runway's image_to_video validator returns a wall-of-JSON 400
    // when prompt_image_url isn't absolute https:// (or runway://, or
    // data:image/). Catch it server-side with a friendlier message
    // before the upstream call fires. The cover stage now emits
    // absolute URLs, so this is a defensive safety net.
    let img_url = body.prompt_image_url.trim();
    if img_url.is_empty()
        || !(img_url.starts_with("https://")
            || img_url.starts_with("runway://")
            || img_url.starts_with("data:image/"))
    {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(json!({
                "ok": false,
                "error": "invalid_prompt_image_url",
                "detail": format!(
                    "prompt_image_url must start with https://, runway://, or data:image/ — got {:?}",
                    img_url.chars().take(80).collect::<String>()
                )
            })),
        ));
    }
    let (client, use_user_key, byok_row_id) = resolve_runway_client(&app, user_id).await?;
    let asset = client
        .image_to_video(&RunwayVideoRequest {
            prompt_image_url: body.prompt_image_url.clone(),
            prompt_text: body.prompt_text.clone(),
            ratio: body.ratio.clone(),
            model: body.model.clone(),
            duration_secs: body.duration_secs,
        })
        .await
        .map_err(upstream_error)?;

    let engine = "runway";
    let version = "gen3";
    let cost_cents = if use_user_key {
        byok_orchestration_cents()
    } else {
        price_cents(engine, version)
    };
    if let Some(id) = byok_row_id {
        let _ = engine_credentials::store::mark_used(&app.pool, id).await;
    }
    let _ = meter_usage(
        &app.pool,
        user_id,
        "/api/mv/video",
        1,
        cost_cents,
        Some(asset.task_id.clone()),
        meta_json(json!({
            "engine": engine,
            "version": version,
            "model": asset.model,
            "prompt_image_url": body.prompt_image_url,
            "prompt_text": body.prompt_text,
            "duration_secs": body.duration_secs,
            "use_user_key": use_user_key,
        })),
    )
    .await;

    Ok(Json(VideoResponse {
        ok: true,
        task_id: asset.task_id,
        video_url: asset.output_url,
        model: asset.model,
        engine,
        version,
        cost_cents,
        use_user_key,
    }))
}

// --------------------------------------------------------------- /mv/compose

// CSSOS_PHASE2_MV_KEEPALIVE 20260425 #112 — ffmpeg muxing of full MV
// can exceed 60s for hybrid timelines. Wrap with keepalive heartbeat.
async fn compose(
    _state: State<AppState>,
    auth: AuthSession,
    Json(body): Json<ComposeRequest>,
) -> axum::response::Response {
    crate::mv_keepalive::keepalive_json(
        async move { compose_inner(auth, body).await },
        std::time::Duration::from_secs(30),
    )
    .await
}

async fn compose_inner(
    auth: AuthSession,
    body: ComposeRequest,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let _user_id = require_user(&auth).await?;
    // Compose has no 3P cost — it's local ffmpeg. We still return an identical
    // shape so the frontend can uniformly track stage output.
    let result = compose_mv(&body).await.map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"ok": false, "error": "compose_failed", "detail": e.to_string()})),
        )
    })?;
    Ok(Json(json!({
        "ok": true,
        "mv_id": result.mv_id,
        "final_path": result.final_path,
        "public_url": result.public_url,
        "width": result.width,
        "height": result.height,
        "duration_secs": result.duration_secs,
        "engine": "cssos-ffmpeg",
        "version": "local",
        "cost_cents": 0i64,
    })))
}

// ---------------------------------------------------------------- /mv/commit

#[derive(Debug, Deserialize)]
pub struct CommitRequest {
    pub title: String,
    #[serde(default)]
    pub style: Option<String>,
    #[serde(default)]
    pub lyrics_preview: Option<String>,
    #[serde(default)]
    pub cover_image_url: Option<String>,
    #[serde(default)]
    pub preview_image_url: Option<String>,
    #[serde(default)]
    pub preview_video_url: Option<String>,
    #[serde(default)]
    pub final_mv_url: Option<String>,
    #[serde(default)]
    pub source_run_id: Option<String>,
    /// Per-stage engine cost breakdown (`cover_cents`, `music_cents`, ...)
    #[serde(default)]
    pub engine_costs_cents: HashMap<String, i64>,
}

#[derive(Debug, Serialize)]
pub struct CommitResponse {
    pub ok: bool,
    pub work_id: Uuid,
    pub total_engine_cost_cents: i64,
    /// CSSOS_PHASE2_AUTOSAVE 20260426 #147 — Jing
    /// "Save as work不应该有这个按钮，我点了3次，作品中心/为你创作都有3个重复的作品。"
    /// `dedup: true` means we found a pre-existing user_works row with the
    /// same (user_id, source_run_id) and returned that work_id instead of
    /// inserting a new one. Frontend uses this to suppress the "saved" toast
    /// flicker on a repeat POST and to confirm the auto-save guard worked.
    #[serde(default)]
    pub dedup: bool,
}

// CSSOS_PHASE2_PIPELINE_KEEPALIVE 20260426 #122 — Jing
// Commit performs multi-row DB inserts (works + work_engines + ledger);
// under contention this can stretch past nginx's 60s read timeout.
async fn commit(
    State(app): State<AppState>,
    auth: AuthSession,
    Json(body): Json<CommitRequest>,
) -> axum::response::Response {
    crate::mv_keepalive::keepalive_json(
        async move { commit_inner(app, auth, body).await },
        std::time::Duration::from_secs(30),
    )
    .await
}

async fn commit_inner(
    app: AppState,
    auth: AuthSession,
    body: CommitRequest,
) -> Result<Json<CommitResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = require_user(&auth).await?;
    let total: i64 = body.engine_costs_cents.values().sum();

    // Build the cost-meta JSON we stamp on the work so the works-panel can
    // render the "第三方引擎成本" breakdown the user asked for.
    let _engine_cost_json = serde_json::to_value(&body.engine_costs_cents).unwrap_or(json!({}));

    // CSSOS_PHASE2_AUTOSAVE 20260426 #147 — Jing
    // "Save as work不应该有这个按钮，我点了3次，作品中心/为你创作都有3个重复的作品。"
    // Dedup on (user_id, source_run_id) before INSERT so duplicate POSTs from
    // the auto-save path (or any future programmatic caller) reuse the same
    // work_id instead of producing 3× rows in user_works. The frontend already
    // tracks `state.committedMvId` to short-circuit, but this is defense in
    // depth — losing one round-trip here is much cheaper than fixing duped
    // rows after the fact.
    if let Some(run_id) = body.source_run_id.as_deref().filter(|s| !s.is_empty()) {
        let existing: Option<(Uuid, i64)> = sqlx::query_as(
            "SELECT id, COALESCE(compute_cost_cents_estimate, 0) \
             FROM user_works \
             WHERE user_id = $1 AND source_run_id = $2 \
             ORDER BY created_at DESC \
             LIMIT 1",
        )
        .bind(user_id)
        .bind(run_id)
        .fetch_optional(&app.pool)
        .await
        .map_err(sql_error)?;
        if let Some((existing_id, existing_total)) = existing {
            tracing::info!(
                target = "mv_pipeline_commit",
                user_id = %user_id,
                source_run_id = %run_id,
                work_id = %existing_id,
                "commit dedup hit — returning existing work_id (no INSERT)"
            );
            return Ok(Json(CommitResponse {
                ok: true,
                work_id: existing_id,
                total_engine_cost_cents: existing_total,
                dedup: true,
            }));
        }
    }

    // Create the work row. `compute_cost_cents_estimate` already exists on the
    // table (migration 012) so we can stash the engine total there without a
    // new migration; the detailed breakdown goes on work_assets.meta.
    let row: (Uuid,) = sqlx::query_as(
        "INSERT INTO user_works (user_id, title, style, lyrics_preview, status, source_run_id, \
         compute_cost_cents_estimate, cover_image, preview_image_url, preview_video_url) \
         VALUES ($1, $2, $3, $4, 'ready', $5, $6, $7, $8, $9) \
         RETURNING id",
    )
    .bind(user_id)
    .bind(&body.title)
    .bind(body.style.as_deref())
    .bind(body.lyrics_preview.as_deref())
    .bind(body.source_run_id.as_deref())
    .bind(total)
    .bind(body.cover_image_url.as_deref())
    .bind(body.preview_image_url.as_deref())
    .bind(body.preview_video_url.as_deref())
    .fetch_one(&app.pool)
    .await
    .map_err(sql_error)?;
    let work_id = row.0;

    // Record the final MV asset with the full engine-cost breakdown in meta.
    if let Some(mv_url) = body.final_mv_url.as_deref() {
        let meta = json!({
            "kind": "third_party_pipeline",
            "engines": body.engine_costs_cents,
            "total_cents": total,
        });
        let _ = sqlx::query(
            "INSERT INTO work_assets (work_id, asset_type, url, meta) \
             VALUES ($1, 'final_mv', $2, $3) \
             ON CONFLICT (work_id, asset_type) DO UPDATE \
             SET url = EXCLUDED.url, meta = EXCLUDED.meta",
        )
        .bind(work_id)
        .bind(mv_url)
        .bind(meta)
        .execute(&app.pool)
        .await;
    }

    Ok(Json(CommitResponse {
        ok: true,
        work_id,
        total_engine_cost_cents: total,
        dedup: false,
    }))
}

// -------------------------------------------------------------- error helpers

fn upstream_not_configured<E: std::fmt::Display>(e: E) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({
            "ok": false,
            "error": "upstream_not_configured",
            "detail": e.to_string(),
        })),
    )
}

fn upstream_error<E: std::fmt::Display>(e: E) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::BAD_GATEWAY,
        Json(json!({
            "ok": false,
            "error": "upstream_failed",
            "detail": e.to_string(),
        })),
    )
}

fn sql_error(e: sqlx::Error) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({"ok": false, "error": "db_error", "detail": e.to_string()})),
    )
}

fn llm_error(e: crate::llm::LlmError) -> (StatusCode, Json<serde_json::Value>) {
    match e {
        crate::llm::LlmError::NotConfigured => upstream_not_configured(e),
        _ => upstream_error(e),
    }
}

// ---------------------------------------------------------------- /mv/lyrics
//
// Lyrics generation via either OpenAI chat-completions or Anthropic messages
// API. Engine/version are caller-supplied so the frontend's advanced-settings
// engine picker can route to the user's preferred provider. Defaults come
// from `billing_matrix::default_engine_for_stage("lyrics")` so ops can change
// the default without a code change.
//
// All prompts are env-overridable. Never hardcoded Chinese/English strings so
// i18n + A/B tuning are possible without a redeploy.

#[derive(Debug, Deserialize)]
pub struct LyricsRequest {
    // CSSOS_PHASE2_P2_58 20260419 — prompt no longer required; empty/missing
    // gets a random-bank fallback so the lyrics stage never hard-errors on a
    // legitimately-silent caller (voice entry, retry flow, partial LLM fail).
    #[serde(default)]
    pub prompt: String,
    #[serde(default)]
    pub language: Option<String>,
    #[serde(default)]
    pub style: Option<String>,
    #[serde(default)]
    pub engine: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    /// Optional override for the system prompt. Falls back to env
    /// `CSSMV_LYRICS_SYSTEM_PROMPT` and finally a safe built-in.
    #[serde(default)]
    pub system_prompt: Option<String>,
    /// P2-41: civilization/cultural-frame hints so the LLM respects
    /// the user's cultural framing (e.g. "东亚华语", "日本当代", "Latin pop").
    #[serde(default)]
    pub civilization: Option<String>,
    #[serde(default)]
    pub cultural_frame: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct LyricsResponse {
    pub ok: bool,
    pub task_id: String,
    pub lyrics: String,
    pub language: Option<String>,
    pub engine: String,
    pub version: String,
    pub provider_model: String,
    pub cost_cents: i64,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
}

fn default_lyrics_system_prompt() -> String {
    std::env::var("CSSMV_LYRICS_SYSTEM_PROMPT")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            "You are a professional songwriter. Produce original, singable lyrics \
             based on the user's theme. Keep verses and chorus clearly separated. \
             Match the requested language and style. Do not include chord notation \
             or stage directions. Return the lyrics only, no preamble."
                .to_string()
        })
}

// CSSOS_PHASE2_PIPELINE_KEEPALIVE 20260426 #122 — Jing
// Lyrics endpoint can take 15-60s on busy OpenAI / Anthropic backends.
// Wrap with keepalive heartbeat so nginx never 504s the user mid-flight.
async fn lyrics(
    State(app): State<AppState>,
    auth: AuthSession,
    Json(body): Json<LyricsRequest>,
) -> axum::response::Response {
    crate::mv_keepalive::keepalive_json(
        async move { lyrics_inner(app, auth, body).await },
        std::time::Duration::from_secs(30),
    )
    .await
}

async fn lyrics_inner(
    app: AppState,
    auth: AuthSession,
    body: LyricsRequest,
) -> Result<Json<LyricsResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = require_user(&auth).await?;

    // Resolve engine+version from body, falling back to registry default.
    let (engine, version) = match (body.engine.clone(), body.version.clone()) {
        (Some(e), Some(v)) if !e.is_empty() && !v.is_empty() => (e, v),
        _ => {
            let entry = crate::billing_matrix::default_engine_for_stage("lyrics")
                .ok_or_else(|| {
                    (
                        StatusCode::SERVICE_UNAVAILABLE,
                        Json(json!({
                            "ok": false,
                            "error": "no_lyrics_engine_registered",
                        })),
                    )
                })?;
            (entry.engine, entry.version)
        }
    };

    // Build the user prompt with optional style/language hints.
    // P2-41 Jing 2026-04-18: map ISO code -> human-readable name so the LLM
    // never defaults to English/Chinese when we ask for Japanese/Korean/etc.
    fn iso_to_human(code: &str) -> &'static str {
        match code.to_ascii_lowercase().as_str() {
            "zh" | "zh-cn" | "zh-hans" => "Simplified Chinese",
            "zh-tw" | "zh-hant" => "Traditional Chinese",
            "ja" | "jp" => "Japanese",
            "ko" | "kr" => "Korean",
            "en" | "en-us" | "en-gb" => "English",
            "es" => "Spanish",
            "fr" => "French",
            "de" => "German",
            "pt" | "pt-br" => "Portuguese",
            "ru" => "Russian",
            "it" => "Italian",
            "ar" => "Arabic",
            "hi" => "Hindi",
            "id" => "Indonesian",
            "th" => "Thai",
            "tr" => "Turkish",
            "vi" => "Vietnamese",
            _ => "",
        }
    }
    // CSSOS_PHASE2_P2_58 20260419 — fill empty prompt from the random bank in
    // the caller's locale so the LLM always receives a well-formed brief.
    let resolved_prompt = mv_random_inputs::ensure_prompt(
        &body.prompt,
        body.language.as_deref(),
    );
    let mut user_prompt = resolved_prompt.clone();
    if let Some(lang) = body.language.as_deref() {
        if !lang.is_empty() {
            let human = iso_to_human(lang);
            if !human.is_empty() {
                user_prompt = format!(
                    "{}\n\nWrite the lyrics entirely in {} ({}). Do not mix other languages unless the theme explicitly calls for it.",
                    user_prompt, human, lang
                );
            } else {
                user_prompt = format!("{}\n\n(Language: {})", user_prompt, lang);
            }
        }
    }
    if let Some(style) = body.style.as_deref() {
        if !style.is_empty() {
            user_prompt = format!("{}\n(Style: {})", user_prompt, style);
        }
    }
    if let Some(civ) = body.civilization.as_deref() {
        if !civ.is_empty() {
            user_prompt = format!("{}\n(Civilization/cultural context: {})", user_prompt, civ);
        }
    }
    if let Some(frame) = body.cultural_frame.as_deref() {
        if !frame.is_empty() {
            user_prompt = format!("{}\n(Cultural frame: {})", user_prompt, frame);
        }
    }

    let system_prompt = body
        .system_prompt
        .clone()
        .unwrap_or_else(default_lyrics_system_prompt);

    let chat_req = ChatRequest {
        model: version.clone(),
        system: Some(system_prompt),
        user: user_prompt,
        max_tokens: body.max_tokens.unwrap_or(800),
        temperature: std::env::var("CSSMV_LYRICS_TEMPERATURE")
            .ok()
            .and_then(|s| s.parse::<f32>().ok()),
    };

    let result = generate_chat(&engine, &chat_req).await.map_err(llm_error)?;
    let task_id = format!("lyrics-{}", Uuid::new_v4());
    let cost_cents = price_cents(&engine, &version);
    let _ = meter_usage(
        &app.pool,
        user_id,
        "/api/mv/lyrics",
        1,
        cost_cents,
        Some(task_id.clone()),
        meta_json(json!({
            "engine": engine,
            "version": version,
            "language": body.language,
            "style": body.style,
            "input_tokens": result.input_tokens,
            "output_tokens": result.output_tokens,
        })),
    )
    .await;

    Ok(Json(LyricsResponse {
        ok: true,
        task_id,
        lyrics: result.text,
        language: body.language,
        engine: engine.clone(),
        version: version.clone(),
        provider_model: result.model,
        cost_cents,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
    }))
}

// ------------------------------------------------------------- /mv/subtitles
//
// Subtitle generation — defaults to the local srt-v1 engine (free, offline)
// but the engine/version is still caller-supplied so we can later plug in
// 3P transcription services (e.g. Whisper, Deepgram) without changing the
// route surface. All timing parameters come from the request; nothing is
// hardcoded.

#[derive(Debug, Deserialize)]
pub struct SubtitlesRequest {
    // CSSOS_PHASE2_P2_58 20260419 — tolerate missing lyrics/duration gracefully.
    // Empty lyrics → empty SRT (legit: instrumental track); zero duration →
    // empty SRT (legit: caller not ready yet). Never hard-fail at deserialise.
    #[serde(default)]
    pub lyrics: String,
    #[serde(default)]
    pub duration_secs: f64,
    #[serde(default)]
    pub engine: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    /// Optional per-line minimum display duration in seconds. Prevents
    /// flashing captions for very short lines. Env
    /// `CSSMV_SUBTITLES_MIN_LINE_SECS` supplies the default (default 1.2).
    #[serde(default)]
    pub min_line_secs: Option<f64>,
    /// Optional gap between captions in seconds (default 0.08).
    #[serde(default)]
    pub line_gap_secs: Option<f64>,
    /// CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
    /// Real per-line timing from the music engine (Suno's
    /// `metadata.alignedWords` / ElevenLabs `lyrics_with_timing`). When
    /// present and non-empty, `subtitles_inner` builds the SRT directly
    /// from these timestamps and ignores `lyrics` + `duration_secs` for
    /// the timing computation. Falls back to even-divide when missing.
    #[serde(default)]
    pub aligned_lyrics: Option<Vec<crate::music_gen::AlignedLyricLine>>,
}

#[derive(Debug, Serialize)]
pub struct SubtitlesResponse {
    pub ok: bool,
    pub task_id: String,
    pub srt: String,
    pub line_count: usize,
    pub engine: String,
    pub version: String,
    pub cost_cents: i64,
}

fn format_srt_timestamp(mut secs: f64) -> String {
    if secs < 0.0 {
        secs = 0.0;
    }
    let total_ms = (secs * 1000.0).round() as u64;
    let ms = total_ms % 1000;
    let total_s = total_ms / 1000;
    let s = total_s % 60;
    let m = (total_s / 60) % 60;
    let h = total_s / 3600;
    format!("{:02}:{:02}:{:02},{:03}", h, m, s, ms)
}

fn build_local_srt(
    lyrics: &str,
    duration_secs: f64,
    min_line_secs: f64,
    line_gap_secs: f64,
) -> (String, usize) {
    // CSSOS_PHASE2_SUBTITLES_RESILIENCE 20260426 #124 — Jing
    // Three failure modes that previously produced "0 lines":
    //   1. lyrics arrives with literal \n escape sequences (JSON
    //      double-escaped through some path) — split into a single
    //      huge "line" that we then split on the literal \n.
    //   2. lyrics is one big paragraph (no newlines) — use sentence
    //      splitter (./。/!/?/。/！/？) so we still produce captions.
    //   3. duration_secs missing — fall back to 60s so we still emit
    //      timing rather than dropping captions silently.
    let dur = if duration_secs > 0.0 { duration_secs } else { 60.0 };
    let normalized = lyrics
        .replace("\\n", "\n")
        .replace("\\r", "")
        .replace('\r', "");
    let mut lines: Vec<String> = normalized
        .lines()
        .map(|l| {
            // Strip section markers like **Verse 1**, [Chorus], (Bridge)
            // so they don't show up as caption rows.
            let s = l.trim();
            let s = s.trim_start_matches('*').trim_end_matches('*').trim();
            let s = s.trim_start_matches('[').trim_end_matches(']').trim();
            s.to_string()
        })
        .filter(|l| !l.is_empty())
        .filter(|l| {
            // Drop section-marker rows entirely (markdown bold or bracket form).
            let lower = l.to_ascii_lowercase();
            !["verse", "chorus", "bridge", "outro", "intro", "refrain", "hook",
              "pre-chorus", "pre chorus", "interlude", "tag", "coda"]
                .iter()
                .any(|kw| lower.starts_with(kw) && lower.len() <= kw.len() + 4)
        })
        .collect();
    if lines.is_empty() && !normalized.trim().is_empty() {
        // Fallback: single-paragraph lyrics. Split on sentence-end punctuation.
        let split: Vec<String> = normalized
            .split(|c: char| matches!(c, '.' | '!' | '?' | '。' | '！' | '？' | ';' | '；'))
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();
        if !split.is_empty() {
            lines = split;
        }
    }
    if lines.is_empty() {
        // Last-resort: emit a single placeholder line so the stage isn't
        // a hard failure. Better than 0-line empty SRT downstream.
        tracing::warn!(
            target: "cssos::mv::subtitles",
            lyrics_len = lyrics.len(),
            normalized_len = normalized.len(),
            "build_local_srt: producing placeholder — input had no usable lines"
        );
        lines = vec!["♪".to_string()];
    }
    let lines_refs: Vec<&str> = lines.iter().map(|s| s.as_str()).collect();
    let lines = lines_refs;
    let duration_secs = dur;
    let slot = (duration_secs / lines.len() as f64).max(min_line_secs);
    let mut out = String::new();
    for (idx, text) in lines.iter().enumerate() {
        let start = (idx as f64) * slot;
        let mut end = start + slot - line_gap_secs;
        if end > duration_secs {
            end = duration_secs;
        }
        if end <= start {
            end = start + min_line_secs.min(0.5);
        }
        out.push_str(&format!(
            "{}\n{} --> {}\n{}\n\n",
            idx + 1,
            format_srt_timestamp(start),
            format_srt_timestamp(end),
            text
        ));
    }
    (out, lines.len())
}

// CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
// Build an SRT from real per-line timestamps emitted by the music engine.
// This is the "we already had the data, we just weren't using it" path —
// each caption matches the actual sung onset/offset instead of being
// even-divided. Empty lines and section markers are still stripped.
//
// Guarantees:
//   * captions are ordered by start_ms ascending
//   * adjacent captions are forced apart by `line_gap_secs` so the
//     renderer doesn't show two cues in the same frame
//   * a caption shorter than `min_line_secs` is stretched (eating into
//     the gap before the next one if needed) so very short words don't
//     flash unreadably fast
//
// Returns (srt_text, line_count) so the caller can record line_count for
// the response (matches the build_local_srt contract above).
fn build_srt_from_aligned(
    aligned: &[crate::music_gen::AlignedLyricLine],
    min_line_secs: f64,
    line_gap_secs: f64,
) -> (String, usize) {
    if aligned.is_empty() {
        return (String::new(), 0);
    }
    // Defensive copy + sort so a malformed ordering from the engine doesn't
    // produce garbled SRT. Strip section markers (verse/chorus headers etc.)
    // and any pure-punctuation lines so they don't show up as captions.
    let mut sorted: Vec<&crate::music_gen::AlignedLyricLine> = aligned
        .iter()
        .filter(|l| {
            let t = l.text.trim();
            if t.is_empty() {
                return false;
            }
            // Section markers like **Verse 1**, [Chorus], (Bridge) — same
            // strip rules build_local_srt uses. Engine-provided alignment
            // sometimes echoes these back as lyric lines.
            let stripped = t
                .trim_start_matches('*')
                .trim_end_matches('*')
                .trim_start_matches('[')
                .trim_end_matches(']')
                .trim_start_matches('(')
                .trim_end_matches(')')
                .trim();
            !stripped.is_empty()
                && !stripped.eq_ignore_ascii_case("verse")
                && !stripped.eq_ignore_ascii_case("chorus")
                && !stripped.eq_ignore_ascii_case("bridge")
                && !stripped.eq_ignore_ascii_case("outro")
                && !stripped.eq_ignore_ascii_case("intro")
        })
        .collect();
    sorted.sort_by_key(|l| l.start_ms);

    let mut out = String::new();
    let count = sorted.len();
    let min_line_ms = (min_line_secs * 1000.0).round() as u64;
    let gap_ms = (line_gap_secs * 1000.0).round() as u64;

    for (idx, line) in sorted.iter().enumerate() {
        let mut start_ms = line.start_ms;
        let mut end_ms = line.end_ms.max(start_ms);

        // Enforce minimum line duration. If the next line's start is too
        // close, eat into that gap rather than overlapping.
        if end_ms.saturating_sub(start_ms) < min_line_ms {
            let next_start = sorted
                .get(idx + 1)
                .map(|l| l.start_ms)
                .unwrap_or(end_ms + min_line_ms);
            let extended = start_ms + min_line_ms;
            end_ms = extended.min(next_start.saturating_sub(gap_ms));
            if end_ms < start_ms + 100 {
                // Pathological short line; clamp to at least 100ms so SRT
                // is still well-formed.
                end_ms = start_ms + 100;
            }
        }

        // Force a gap between consecutive captions. If we'd overlap into
        // the next line's start, pull our end back.
        if let Some(next) = sorted.get(idx + 1) {
            let next_start = next.start_ms;
            if end_ms + gap_ms > next_start {
                end_ms = next_start.saturating_sub(gap_ms).max(start_ms + 100);
            }
        }

        // Strip the same section markers build_local_srt strips, so the
        // engine emitting "**Verse 1** I dreamed a dream" still renders
        // just "I dreamed a dream".
        let cleaned = line
            .text
            .trim()
            .trim_start_matches('*')
            .trim_end_matches('*')
            .trim_start_matches('[')
            .trim_end_matches(']')
            .trim()
            .to_string();

        // Push start_ms back if a previous caption already covers this
        // window (rare with a sorted feed but cheap safety).
        if idx > 0 {
            if let Some(prev) = sorted.get(idx - 1) {
                let prev_end = prev.end_ms.max(prev.start_ms);
                if start_ms < prev_end + gap_ms {
                    start_ms = prev_end + gap_ms;
                    if end_ms <= start_ms {
                        end_ms = start_ms + min_line_ms.max(100);
                    }
                }
            }
        }

        out.push_str(&format!(
            "{}\n{} --> {}\n{}\n\n",
            idx + 1,
            format_srt_timestamp(start_ms as f64 / 1000.0),
            format_srt_timestamp(end_ms as f64 / 1000.0),
            cleaned
        ));
    }
    (out, count)
}

#[cfg(test)]
mod aligned_srt_tests {
    use super::*;
    use crate::music_gen::AlignedLyricLine;

    fn line(text: &str, start: u64, end: u64) -> AlignedLyricLine {
        AlignedLyricLine {
            text: text.to_string(),
            start_ms: start,
            end_ms: end,
            section: None,
        }
    }

    #[test]
    fn renders_in_order_with_real_timing() {
        let aligned = vec![
            line("First line", 500, 3200),
            line("Second line", 3500, 6000),
        ];
        let (srt, n) = build_srt_from_aligned(&aligned, 1.2, 0.08);
        assert_eq!(n, 2);
        assert!(srt.contains("00:00:00,500 --> 00:00:03,200"));
        assert!(srt.contains("First line"));
        assert!(srt.contains("00:00:03,500 --> 00:00:06,000"));
        assert!(srt.contains("Second line"));
    }

    #[test]
    fn enforces_minimum_line_duration() {
        // Line is 200ms — much shorter than 1200ms min.
        let aligned = vec![line("Quick word", 1000, 1200), line("Next", 5000, 7000)];
        let (srt, _) = build_srt_from_aligned(&aligned, 1.2, 0.08);
        // The first cue should be stretched to ~1200ms (cue 1 ends at 02,200).
        assert!(srt.contains("00:00:01,000 --> 00:00:02,200"));
    }

    #[test]
    fn strips_section_markers() {
        let aligned = vec![
            line("**Verse 1**", 0, 500),
            line("Real line", 500, 3000),
        ];
        let (srt, n) = build_srt_from_aligned(&aligned, 1.2, 0.08);
        assert_eq!(n, 1);
        assert!(!srt.contains("Verse 1"));
        assert!(srt.contains("Real line"));
    }

    #[test]
    fn empty_input_returns_empty() {
        let (srt, n) = build_srt_from_aligned(&[], 1.2, 0.08);
        assert!(srt.is_empty());
        assert_eq!(n, 0);
    }
}

// CSSOS_PHASE2_PIPELINE_KEEPALIVE 20260426 #122 — Jing
// Subtitles default to local SRT (fast), but Whisper/AssemblyAI paths
// can run minutes. Wrap with keepalive heartbeat for safety.
async fn subtitles(
    State(app): State<AppState>,
    auth: AuthSession,
    Json(body): Json<SubtitlesRequest>,
) -> axum::response::Response {
    crate::mv_keepalive::keepalive_json(
        async move { subtitles_inner(app, auth, body).await },
        std::time::Duration::from_secs(30),
    )
    .await
}

async fn subtitles_inner(
    app: AppState,
    auth: AuthSession,
    body: SubtitlesRequest,
) -> Result<Json<SubtitlesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = require_user(&auth).await?;

    let (engine, version) = match (body.engine.clone(), body.version.clone()) {
        (Some(e), Some(v)) if !e.is_empty() && !v.is_empty() => (e, v),
        _ => {
            let entry = crate::billing_matrix::default_engine_for_stage("subtitles")
                .ok_or_else(|| {
                    (
                        StatusCode::SERVICE_UNAVAILABLE,
                        Json(json!({
                            "ok": false,
                            "error": "no_subtitles_engine_registered",
                        })),
                    )
                })?;
            (entry.engine, entry.version)
        }
    };

    // For now only the local srt-v1 engine is implemented. Future engines
    // (e.g. Whisper, Deepgram) can branch on engine name here without the
    // route surface changing.
    let (srt, line_count) = if engine == "cssmv-local" && version == "srt-v1" {
        let min_line = body.min_line_secs.unwrap_or_else(|| {
            std::env::var("CSSMV_SUBTITLES_MIN_LINE_SECS")
                .ok()
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(1.2)
        });
        let gap = body.line_gap_secs.unwrap_or_else(|| {
            std::env::var("CSSMV_SUBTITLES_LINE_GAP_SECS")
                .ok()
                .and_then(|s| s.parse::<f64>().ok())
                .unwrap_or(0.08)
        });
        // CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
        // When the music engine emitted real per-line timing, build the SRT
        // from those timestamps instead of fabricating it via even-divide.
        // This is the whole reason every caption used to drift relative to
        // the actual vocal performance — we had the data on every Suno /
        // ElevenLabs run and just weren't capturing it.
        match body
            .aligned_lyrics
            .as_ref()
            .filter(|v| !v.is_empty())
        {
            Some(lines) => {
                tracing::info!(
                    target = "mv_pipeline_subtitles",
                    line_count = lines.len(),
                    "subtitles using REAL aligned_lyrics timings"
                );
                build_srt_from_aligned(lines, min_line, gap)
            }
            None => {
                tracing::info!(
                    target = "mv_pipeline_subtitles",
                    "subtitles falling back to even-divide (no aligned_lyrics)"
                );
                build_local_srt(&body.lyrics, body.duration_secs, min_line, gap)
            }
        }
    } else {
        return Err((
            StatusCode::NOT_IMPLEMENTED,
            Json(json!({
                "ok": false,
                "error": "subtitles_engine_not_implemented",
                "engine": engine,
                "version": version,
            })),
        ));
    };

    let task_id = format!("subtitles-{}", Uuid::new_v4());
    let cost_cents = price_cents(&engine, &version);
    let _ = meter_usage(
        &app.pool,
        user_id,
        "/api/mv/subtitles",
        1,
        cost_cents,
        Some(task_id.clone()),
        meta_json(json!({
            "engine": engine,
            "version": version,
            "duration_secs": body.duration_secs,
            "line_count": line_count,
        })),
    )
    .await;

    Ok(Json(SubtitlesResponse {
        ok: true,
        task_id,
        srt,
        line_count,
        engine,
        version,
        cost_cents,
    }))
}

// -------------------------------------------------------------- /mv/engines
//
// Engine catalog endpoint — frontend advanced-settings panel calls this to
// populate per-stage engine selectors. Returning the registry from the
// backend means we never hardcode engine names in the UI; adding a new
// engine on the server automatically makes it available in the picker.

#[derive(Debug, Serialize)]
pub struct EnginesCatalogResponse {
    pub ok: bool,
    pub stages: Vec<StageCatalogEntry>,
    pub flat: Vec<EngineCatalogEntry>,
}

#[derive(Debug, Serialize)]
pub struct StageCatalogEntry {
    pub stage: String,
    pub stage_i18n_key: String,
    pub engines: Vec<EngineCatalogEntry>,
    pub default_engine: Option<String>,
    pub default_version: Option<String>,
}

async fn engines_catalog(
    _state: State<AppState>,
) -> Result<Json<EnginesCatalogResponse>, (StatusCode, Json<serde_json::Value>)> {
    // Stage order is intentionally parameter-driven — ops can reorder by
    // setting `CSSMV_STAGE_ORDER` (comma-separated) without a code change.
    let stage_order: Vec<String> = std::env::var("CSSMV_STAGE_ORDER")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.split(',').map(|p| p.trim().to_string()).collect())
        .unwrap_or_else(|| {
            vec![
                "cover".into(),
                "lyrics".into(),
                "music".into(),
                "video".into(),
                "subtitles".into(),
                "compose".into(),
            ]
        });

    let flat = engine_registry();
    let stages = stage_order
        .into_iter()
        .map(|stage| {
            let engines = engines_for_stage(&stage);
            // CSSOS_PHASE2_P2_87_NO_MUSICGPT_DEFAULT 20260424 — prefer a
            // default engine whose API key is actually configured on this
            // server, with MusicGPT excluded. Falls back to the static
            // is_default=true row, and then to the first row, so the
            // response is always well-formed even for stages we haven't
            // runtime-gated yet (cover, video, etc.).
            let default = engines
                .iter()
                .find(|e| is_music_engine_ready(&e.engine) && e.engine != "musicgpt")
                .cloned()
                .or_else(|| engines.iter().find(|e| e.is_default).cloned())
                .or_else(|| engines.first().cloned());
            StageCatalogEntry {
                stage_i18n_key: format!("mv.stage.{}.label", stage),
                stage: stage.clone(),
                engines,
                default_engine: default.as_ref().map(|e| e.engine.clone()),
                default_version: default.as_ref().map(|e| e.version.clone()),
            }
        })
        .collect();

    Ok(Json(EnginesCatalogResponse {
        ok: true,
        stages,
        flat,
    }))
}

// ---------------------------------------------------------------- /mv/tiers
//
// CSSOS_PHASE2_MV_TIERS 20260419 — Three-tier cost estimator endpoint.
// Frontend MV Pipeline panel's cost slider reads this to render the three
// bundles (Lite / Hybrid / Cinematic) and label the currently-configured
// pipeline against its matching tier. Keeping the estimator server-side
// means price changes roll out without a UI redeploy.

#[derive(Debug, Serialize)]
pub struct TiersCatalogResponse {
    pub ok: bool,
    pub tiers: Vec<MvTier>,
    /// Default tier id to highlight on first paint. Ops can override via
    /// CSSMV_DEFAULT_TIER; otherwise we recommend Hybrid as the sweet spot.
    pub default_tier: String,
    /// Canonical classifier boundaries so the frontend slider can label
    /// intermediate positions without re-fetching after every drag tick.
    pub classification: TiersClassification,
}

#[derive(Debug, Serialize)]
pub struct TiersClassification {
    /// AI-video-share thresholds (inclusive, pct). ratio <= lite_max is lite;
    /// ratio <= hybrid_max is hybrid; above is cinematic.
    pub lite_max: u32,
    pub hybrid_max: u32,
}

#[derive(Debug, Deserialize)]
pub struct TierClassifyQuery {
    /// Seconds of AI-video content in the current segment plan.
    #[serde(default)]
    pub ai_video_secs: Option<f64>,
    /// Total song / MV duration in seconds.
    #[serde(default)]
    pub total_secs: Option<f64>,
}

async fn tiers_catalog(
    _state: State<AppState>,
    Query(q): Query<TierClassifyQuery>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<serde_json::Value>)> {
    let tiers = mv_tiers();
    let default_tier = std::env::var("CSSMV_DEFAULT_TIER")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| "hybrid".into());

    let mut body = serde_json::to_value(TiersCatalogResponse {
        ok: true,
        tiers,
        default_tier,
        classification: TiersClassification {
            lite_max: 5,
            hybrid_max: 60,
        },
    })
    .map_err(|e| {
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"ok": false, "error": "serialize_failed", "detail": e.to_string()})),
        )
    })?;

    // If the caller supplied a concrete plan via query params, annotate the
    // response with which tier that plan falls in. Keeps the classifier in
    // one place so analytics, compose, and the UI label all agree.
    if let (Some(ai), Some(total)) = (q.ai_video_secs, q.total_secs) {
        let (ratio_pct, tier_id) = classify_tier_by_seconds(ai, total);
        if let serde_json::Value::Object(ref mut map) = body {
            map.insert(
                "current_plan".into(),
                json!({
                    "ai_video_secs": ai,
                    "total_secs": total,
                    "ai_video_ratio_pct": ratio_pct,
                    "tier_id": tier_id,
                }),
            );
        }
    }

    Ok(Json(body))
}
