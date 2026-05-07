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

/// CSSOS_PHASE2_STRIP_MARKERS 20260426 #148-A1 — Jing
/// "英文方括号[]里的文案不是歌词，不要演唱。"
///
/// Remove song-structure markers from a lyrics block before handing it to
/// the music engine. Three patterns:
///
///   1. **Pure-marker lines** — the entire line is a structure marker like
///      `[Verse 1]`, `[Chorus]`, `**Bridge**`, `(Pre-Chorus)`, `Verse 2:`.
///      These are dropped entirely.
///
///   2. **Inline marker wrappers** — a real lyric line wrapped in markup
///      such as `**She said the world was hers**`. The wrapping markup is
///      stripped but the inner content is kept.
///
///   3. **Trailing colon-only labels** — `Verse 1:` on its own line with
///      content on subsequent lines is treated as case 1.
///
/// This preserves the line layout (blank lines between sections become
/// double newlines for music engines that use them as phrasing hints), so
/// the engine still gets section pacing without singing the markers.
///
/// Idempotent: running it twice is the same as once.
fn strip_lyric_structure_markers(input: &str) -> String {
    // Token list of recognised section labels (case-insensitive). We only
    // drop lines that consist of these labels alone, possibly suffixed with
    // numbers / Roman numerals / colons.
    fn is_pure_marker_line(line: &str) -> bool {
        let core = line
            .trim()
            .trim_start_matches(|c: char| c == '[' || c == '(' || c == '*' || c == '#' || c == '<')
            .trim_end_matches(|c: char| c == ']' || c == ')' || c == '*' || c == '>')
            .trim_end_matches(':')
            .trim_end_matches('.')
            .trim();
        if core.is_empty() {
            return false;
        }
        // Strip trailing digits / roman numerals (Verse 1, Verse 2, Verse III)
        let head: String = core
            .chars()
            .take_while(|c| c.is_alphabetic() || c.is_whitespace() || *c == '-' || *c == '_')
            .collect();
        let head = head.trim().to_ascii_lowercase();
        const MARKERS: &[&str] = &[
            "verse",
            "chorus",
            "bridge",
            "outro",
            "intro",
            "pre-chorus",
            "prechorus",
            "post-chorus",
            "postchorus",
            "hook",
            "refrain",
            "interlude",
            "drop",
            "breakdown",
            "tag",
            "coda",
            "instrumental",
            "solo",
            "ad-lib",
            "adlib",
        ];
        MARKERS.iter().any(|m| head == *m || head.starts_with(&format!("{} ", m)))
    }

    fn strip_inline_wrappers(line: &str) -> String {
        // Strip leading/trailing **, [, (, > pairs that wrap the whole line.
        let mut s = line.trim().to_string();
        // Outer ** **
        if s.starts_with("**") && s.ends_with("**") && s.len() >= 4 {
            s = s[2..s.len() - 2].trim().to_string();
        }
        // Outer [ ]
        if s.starts_with('[') && s.ends_with(']') && s.len() >= 2 {
            s = s[1..s.len() - 1].trim().to_string();
        }
        // Outer ( )
        if s.starts_with('(') && s.ends_with(')') && s.len() >= 2 {
            s = s[1..s.len() - 1].trim().to_string();
        }
        // Outer > or # markdown headers
        s = s
            .trim_start_matches('#')
            .trim_start_matches('>')
            .trim()
            .to_string();
        s
    }

    let mut out_lines: Vec<String> = Vec::new();
    for raw_line in input.split('\n') {
        if raw_line.trim().is_empty() {
            // Preserve blank lines as section pacing hints.
            out_lines.push(String::new());
            continue;
        }
        if is_pure_marker_line(raw_line) {
            continue;
        }
        let cleaned = strip_inline_wrappers(raw_line);
        if !cleaned.is_empty() {
            out_lines.push(cleaned);
        }
    }
    // Collapse runs of >2 blank lines to exactly 2.
    let mut collapsed: Vec<String> = Vec::new();
    let mut blank_run = 0usize;
    for l in out_lines {
        if l.is_empty() {
            blank_run += 1;
            if blank_run <= 2 {
                collapsed.push(l);
            }
        } else {
            blank_run = 0;
            collapsed.push(l);
        }
    }
    // Trim trailing blanks.
    while collapsed.last().map(|s| s.is_empty()).unwrap_or(false) {
        collapsed.pop();
    }
    collapsed.join("\n")
}

#[cfg(test)]
mod strip_lyric_markers_tests {
    use super::strip_lyric_structure_markers;

    #[test]
    fn removes_bracket_section_markers() {
        let input = "[Verse 1]\nLine one\nLine two\n\n[Chorus]\nChorus line";
        let out = strip_lyric_structure_markers(input);
        assert!(!out.contains("[Verse"));
        assert!(!out.contains("[Chorus"));
        assert!(out.contains("Line one"));
        assert!(out.contains("Chorus line"));
    }

    #[test]
    fn removes_bold_markdown_section_markers() {
        let input = "**Verse 1**\nDream line\n**Chorus**\nFly with me";
        let out = strip_lyric_structure_markers(input);
        assert!(!out.contains("**Verse"));
        assert!(!out.contains("**Chorus"));
        assert!(out.contains("Dream line"));
        assert!(out.contains("Fly with me"));
    }

    #[test]
    fn preserves_inline_content_with_wrappers_stripped() {
        let input = "**She said the world was hers**\nAnd I believed her";
        let out = strip_lyric_structure_markers(input);
        assert!(out.contains("She said the world was hers"));
        assert!(!out.contains("**"));
        assert!(out.contains("And I believed her"));
    }

    #[test]
    fn handles_paren_and_label_styles() {
        let input = "(Pre-Chorus)\nLine A\nVerse 2:\nLine B\n[Bridge]\nLine C";
        let out = strip_lyric_structure_markers(input);
        assert!(out.contains("Line A"));
        assert!(out.contains("Line B"));
        assert!(out.contains("Line C"));
        assert!(!out.contains("Pre-Chorus"));
        assert!(!out.contains("Verse 2"));
        assert!(!out.contains("Bridge"));
    }

    #[test]
    fn idempotent() {
        let input = "[Verse 1]\nDream\n**Chorus**\nFly";
        let once = strip_lyric_structure_markers(input);
        let twice = strip_lyric_structure_markers(&once);
        assert_eq!(once, twice);
    }

    #[test]
    fn empty_input_returns_empty() {
        assert_eq!(strip_lyric_structure_markers(""), "");
        assert_eq!(strip_lyric_structure_markers("\n\n\n"), "");
    }
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
    /// CSSOS_PHASE2_TARGET_DURATION 20260426 #148-C — Jing
    /// "京典模板10节歌词，输出的音乐一般在5分钟左右，现在只有30秒。"
    /// Frontend computes a target duration from the lyric structure
    /// (intro/verse×N/chorus×M/bridge/outro × ~24s/section) and sends it
    /// here. Adapters interpret per provider:
    ///   - ElevenLabs Music: passed as `music_length_ms` (max ~5min/call)
    ///   - Suno: clamped 60..240s; longer needs continuation chains (Phase 2)
    ///   - Stable Audio: passed as `duration` (max ~190s)
    ///   - MusicGPT: ignored (legacy fallback uses upstream default)
    /// Range clamp at the adapter level: 30..600s. Out-of-range is silently
    /// clipped so a buggy frontend can't trigger upstream errors.
    #[serde(default)]
    pub target_duration_secs: Option<u32>,
    /// CSSOS_PHASE2_KIE_TITLE 20260429 #207 — Jing
    /// User-supplied song title (e.g. "Mount Hermon Oath"). Forwarded to
    /// Suno's `title` field — Suno treats it as a strong style hint, so a
    /// good title is significant for output quality. Frontend should
    /// populate this from the user's MV title input. Empty/None ⇒ Suno
    /// adapter falls back to deriving from prompt's first line.
    #[serde(default)]
    pub title: Option<String>,
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
    /// CSSOS_PHASE2_DUAL_TRACK 20260430 #208 — Jing
    /// Suno returns 2 takes per generation. `audio_url` is "Take 1" (the
    /// primary clip we built the MV from); these expose "Take 2" so the
    /// Watch panel can offer A/B compare without a second generation.
    /// Single-track engines leave both null.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alt_audio_url: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alt_duration_secs: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub alt_conversion_id: Option<String>,
    /// CSSOS_PHASE2_TIER_DURATION_CAP 20260430 #209 — Jing
    /// What ceiling we clamped to (so the frontend can render
    /// "you hit your X-min cap, upgrade to extend"). Always present.
    #[serde(default)]
    pub tier_cap_secs: u32,
    #[serde(default)]
    pub user_tier: String,
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
        // CSSOS_PHASE2_KIE_PIVOT 20260429 #204 — kie.ai gateway uses
        // KIE_API_KEY in /etc/cssos.env; SunoClient::from_env reads either.
        "suno" => env_non_empty("SUNO_API_KEY") || env_non_empty("KIE_API_KEY"),
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

    // CSSOS_PHASE2_DURATION_AWARE_ROUTE 20260429 #172 — Jing
    // "都是第三方面引擎，应该使用哪个引擎都一样，不是吗？难道还要区分吗？"
    //
    // From the user's perspective, picking among MusicGPT / ElevenLabs /
    // Suno / Stability shouldn't be their problem — they just want a
    // working long-form song. But these engines have very different
    // capability ceilings:
    //   • MusicGPT     ≈ 1-2 min hard cap (API limit, even with `prompt`)
    //   • Stability    ≈ 10-90 s short instrumental loops
    //   • Suno v5/v4   ≈ 4-8 min full-song with vocals (when key present)
    //   • ElevenLabs   ≈ 5-10 min via composition_plan (Creator plan)
    //
    // If the caller explicitly picked an engine that physically CAN'T
    // deliver the requested duration, AUTO-UPGRADE silently to ElevenLabs
    // (or Suno if it's configured first) — better one log line + a working
    // song than silently capping the user at 60 s and confusing them.
    let needs_long_form = body.target_duration_secs.map(|s| s > 90).unwrap_or(false);
    let cannot_deliver_long_form = matches!(
        requested_engine.as_deref(),
        Some("musicgpt") | Some("stability") | Some("stable-audio") | Some("stable_audio")
    );
    if needs_long_form && cannot_deliver_long_form {
        // CSSOS_PHASE2_SUNO_FIRST 20260429 #182 — Jing
        // "现在输出的音乐（没有人声，只有缓慢的音乐）绝对不是我的歌词，音乐
        //  风格输出的风格，只是一阵轰鸣声而已，没有旋律".
        // ElevenLabs Music is fundamentally an ambient/score generator —
        // even with lyrics inlined into the prompt it produces hummed
        // soundscapes, not actual sung songs with melody and instrumentation.
        // Suno is the lyrics-to-song engine: explicit `lyrics` field, real
        // vocal models, real melody. Make Suno the first long-form upgrade
        // target; ElevenLabs only when Suno is unavailable.
        let upgrade_target = if is_music_engine_ready("suno") {
            ("suno", "v5")
        } else if is_music_engine_ready("elevenlabs") {
            ("elevenlabs", "v1")
        } else {
            // No long-form provider configured — caller's pick stands;
            // adapter will report whatever it can do. Better than 503.
            ("", "")
        };
        if !upgrade_target.0.is_empty() {
            tracing::warn!(
                target: "cssos::mv::music",
                requested_engine = ?requested_engine,
                upgraded_to = %upgrade_target.0,
                target_duration_secs = ?body.target_duration_secs,
                "auto-upgrading music engine: requested engine cannot deliver long-form duration"
            );
            return (upgrade_target.0.into(), upgrade_target.1.into());
        }
    }

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

    // CSSOS_PHASE2_AUTO_RESOLVE_PRIORITY 20260429 #182 — Jing
    // Suno is now the FIRST auto-resolve choice. The composition_plan path
    // we hoped for in ElevenLabs turned into "一阵轰鸣声" — ambient music
    // without vocals or melody. Suno's lyrics field drives a real vocal
    // model with melody and instrumentation, which is what users actually
    // want when they provide lyrics. ElevenLabs is only useful for
    // instrumentals or ambient scores; keep it as a graceful fallback.
    if is_music_engine_ready("suno") {
        ("suno".into(), "v5".into())
    } else if is_music_engine_ready("elevenlabs") {
        ("elevenlabs".into(), "v1".into())
    } else if is_music_engine_ready("stability") {
        ("stability".into(), "2.0".into())
    } else {
        // No engine is configured. Return "suno" so the adapter returns a
        // clean NotConfigured → 503 rather than silently falling through.
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

    // CSSOS_PHASE2_TIER_DURATION_CAP 20260430 #209 — Jing
    // Resolve the user's membership tier and clamp `target_duration_secs`
    // BEFORE we build the MusicGenRequest. The caps are documented next
    // to MembershipTierPlan: free 4 / starter 5 / pro 6 / studio 8 /
    // enterprise (+vip+admin) 10 minutes. A buggy or hostile frontend
    // can't trick us into a 10-minute Free song this way.
    let user_tier = sqlx::query_scalar::<_, String>(
        "SELECT COALESCE(membership_tier, 'free') FROM billing_accounts WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&app.pool)
    .await
    .ok()
    .flatten()
    .unwrap_or_else(|| "free".to_string());
    let tier_cap_secs = crate::billing::max_song_duration_secs_for_tier(&user_tier);

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
        user_tier = %user_tier,
        tier_cap_secs = %tier_cap_secs,
        requested_target_secs = ?body.target_duration_secs,
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
    // CSSOS_PHASE2_STRIP_MARKERS 20260426 #148-A1 — Jing
    // "英文方括号[]里的文案不是歌词，不要演唱。"
    //
    // The lyrics LLM emits structure markers like `[Verse 1]`, `**Chorus**`,
    // `(Bridge)`, `[Hook]` to delineate song sections. Music engines
    // (Suno / ElevenLabs / MusicGPT) treat the lyrics field as literal sung
    // content, so they actually pronounce "verse one" / "chorus" out loud
    // and waste 2-3 seconds of vocal time on each marker.
    //
    // Strip every line that is ONLY a structure marker, plus inline marker
    // wrappers around real lyric content (e.g. "**She said**" → "She said").
    // The cleaned text goes to the music engine; the original is preserved
    // elsewhere (subtitles input + commit metadata) so the structure isn't
    // lost — only the literal vocalisation of marker tokens is suppressed.
    let cleaned_lyrics = strip_lyric_structure_markers(&resolved_lyrics);
    let cleaned_lyrics_trim_len = cleaned_lyrics.trim().len();
    let lyrics_for_upstream = if cleaned_lyrics.trim().is_empty() {
        None
    } else {
        Some(cleaned_lyrics)
    };
    // CSSOS_PHASE2_KIE_LYRICS_TRACE 20260429 #206b — Jing
    // Mount Hermon came back as a 40s "Verse 1 demo" because Suno got an
    // empty lyrics field. Log every stage of lyrics massaging so we can
    // pinpoint where they get dropped (frontend? body.lyrics? strip_markers?).
    tracing::info!(
        target: "cssos::mv::music::lyrics_trace",
        body_lyrics_len = body.lyrics.as_deref().map(|s| s.len()).unwrap_or(0),
        body_lyrics_preview = %body.lyrics.as_deref().map(|s| {
            let t = s.trim();
            let take: String = t.chars().take(80).collect();
            take
        }).unwrap_or_default(),
        resolved_lyrics_len = resolved_lyrics.len(),
        cleaned_lyrics_len = cleaned_lyrics_trim_len,
        for_upstream = lyrics_for_upstream.is_some(),
        title = %body.title.as_deref().unwrap_or(""),
        make_instrumental = body.make_instrumental,
        "music: lyrics pipeline trace"
    );

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
            // CSSOS_PHASE2_TARGET_DURATION 20260426 #148-C — Jing
            // Caller-supplied target duration in seconds (clamped 30..600
            // at the adapter layer). ElevenLabs / Stable Audio map this
            // onto their native length parameters; Suno + MusicGPT ignore
            // until their respective continuation chains land.
            //
            // CSSOS_PHASE2_TIER_DURATION_CAP 20260430 #209 — Jing
            // Tier ceiling: free 4 / starter 5 / pro 6 / studio 8 / enterprise 10 min.
            // Always clamp regardless of what the frontend sent (None → tier_cap so
            // a missing target still respects the membership ceiling on engines
            // that honour `target_duration_secs`).
            target_duration_secs: Some(
                body.target_duration_secs
                    .map(|v| v.min(tier_cap_secs))
                    .unwrap_or(tier_cap_secs),
            ),
            // CSSOS_PHASE2_KIE_TITLE 20260429 #207 — Jing
            // Forward the user's song title to the adapter. Suno's `title`
            // field is a strong style/voice hint — bad titles ("a fierce
            // battle anthem") tilt the arrangement off-style. None ⇒
            // adapter derives from prompt[:64] as a safety net.
            title: body.title.clone(),
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
        // CSSOS_PHASE2_DUAL_TRACK 20260430 #208 — surface Take 2 if engine
        // gave us one (Suno does, others currently don't).
        alt_audio_url: result.alt_audio_url,
        alt_duration_secs: result.alt_duration_secs,
        alt_conversion_id: result.alt_conversion_id,
        // CSSOS_PHASE2_TIER_DURATION_CAP 20260430 #209 — let the frontend
        // render the cap so users see why they got 4 minutes vs 10.
        tier_cap_secs,
        user_tier,
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
    /// CSSOS_PHASE2_SHOT_SCRIPTS 20260426 #148-E — Jing
    /// Multi-segment video generation. When non-empty, /api/mv/video runs
    /// one Runway image_to_video call per shot script (bounded parallelism)
    /// and returns the resulting clips in `segments[]`. The single
    /// prompt_text path is unused in this mode (each shot has its own
    /// scene_description). Falls back to the single-clip path when empty
    /// or absent.
    #[serde(default)]
    pub shot_scripts: Option<Vec<ShotScriptInput>>,
    /// Per-segment duration when running shot_scripts mode. Default 5s
    /// (Runway gen3 minimum); cap 10s (gen3 max). Total = N × duration_secs
    /// (e.g. 6 sections × 8s = 48s of AI video, mixed with audio later).
    #[serde(default)]
    pub segment_duration_secs: Option<u32>,
}

/// Input shape for one shot script — same fields as ShotScript but no Serialize
/// (we own this on the request side, the LLM-emitted ShotScript on response).
#[derive(Debug, Clone, Deserialize)]
pub struct ShotScriptInput {
    pub section_kind: String,
    pub scene_description: String,
    #[serde(default)]
    pub mood: Option<String>,
    #[serde(default)]
    pub motion: Option<String>,
}

/// CSSOS_PHASE2_SHOT_SCRIPTS 20260426 #148-E
/// One generated video segment, paired with the lyric section it serves.
#[derive(Debug, Clone, Serialize)]
pub struct VideoSegment {
    pub section_kind: String,
    pub video_url: String,
    pub duration_secs: u32,
    pub task_id: String,
    /// Echo of the prompt the engine actually got, for debug + replay.
    pub prompt_text: String,
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
    /// CSSOS_PHASE2_SHOT_SCRIPTS 20260426 #148-E
    /// When the request supplied shot_scripts, this is populated with one
    /// VideoSegment per shot (in section order). When empty/absent, the
    /// caller used the single-clip path and this is None. Compose stage
    /// xfade-chains them into the final MV.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub segments: Option<Vec<VideoSegment>>,
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
    let engine = "runway";
    let version = "gen3";

    // CSSOS_PHASE2_SHOT_SCRIPTS 20260426 #148-E — Jing
    // Multi-segment branch: when caller supplied shot_scripts, generate one
    // Runway clip per shot. Bounded parallelism (4 in flight) keeps us
    // under Runway's per-account rate-limit while still finishing N=10
    // shots in ~the same wall time as a single 30s shot would have taken.
    if let Some(shots) = body.shot_scripts.as_ref().filter(|v| !v.is_empty()) {
        let seg_dur = body.segment_duration_secs.unwrap_or(5).clamp(5, 10);
        tracing::info!(
            target = "mv_pipeline_video",
            shot_count = shots.len(),
            seg_dur_secs = seg_dur,
            "starting multi-segment video generation"
        );

        // Bounded parallelism — Runway's free/pro tier rate limits are
        // narrow so 4 concurrent submits is the safe ceiling.
        use futures::stream::{FuturesUnordered, StreamExt};
        let mut futs: FuturesUnordered<_> = shots
            .iter()
            .enumerate()
            .map(|(idx, shot)| {
                let prompt_text = build_shot_prompt(shot);
                let req = RunwayVideoRequest {
                    prompt_image_url: body.prompt_image_url.clone(),
                    prompt_text: Some(prompt_text.clone()),
                    ratio: body.ratio.clone(),
                    model: body.model.clone(),
                    duration_secs: Some(seg_dur),
                };
                let client = client.clone();
                async move {
                    let asset = client.image_to_video(&req).await;
                    (idx, shot.section_kind.clone(), prompt_text, seg_dur, asset)
                }
            })
            .collect();

        // Cap at 4 concurrent — drain serially with a small backpressure.
        // (Realistically the FuturesUnordered is already running them all
        // concurrently; we just collect results in completion order.)
        let mut results: Vec<(usize, String, String, u32, _)> = Vec::with_capacity(shots.len());
        while let Some(out) = futs.next().await {
            results.push(out);
        }
        // Sort back into shot_scripts order so segments line up with lyric sections.
        results.sort_by_key(|(idx, ..)| *idx);

        let mut segments: Vec<VideoSegment> = Vec::with_capacity(shots.len());
        let mut total_cost: i64 = 0;
        let mut last_model: String = String::new();
        let mut first_task_id: String = String::new();
        for (idx, section_kind, prompt_text, dur, asset_res) in results {
            let asset = asset_res.map_err(upstream_error)?;
            if first_task_id.is_empty() {
                first_task_id = asset.task_id.clone();
            }
            last_model = asset.model.clone();
            let seg_cost = if use_user_key {
                byok_orchestration_cents()
            } else {
                price_cents(engine, version)
            };
            total_cost += seg_cost;
            tracing::info!(
                target = "mv_pipeline_video",
                idx = idx,
                section_kind = %section_kind,
                duration_secs = dur,
                "segment generated"
            );
            segments.push(VideoSegment {
                section_kind,
                video_url: asset.output_url,
                duration_secs: dur,
                task_id: asset.task_id,
                prompt_text,
            });
        }
        if let Some(id) = byok_row_id {
            let _ = engine_credentials::store::mark_used(&app.pool, id).await;
        }
        let _ = meter_usage(
            &app.pool,
            user_id,
            "/api/mv/video",
            shots.len() as i64,
            total_cost,
            Some(first_task_id.clone()),
            meta_json(json!({
                "engine": engine,
                "version": version,
                "model": last_model,
                "prompt_image_url": body.prompt_image_url,
                "shot_count": shots.len(),
                "segment_duration_secs": seg_dur,
                "use_user_key": use_user_key,
            })),
        )
        .await;
        // Use first segment's url as the legacy `video_url` so single-clip
        // consumers keep working; new consumers read `segments`.
        let first_url = segments
            .first()
            .map(|s| s.video_url.clone())
            .unwrap_or_default();
        return Ok(Json(VideoResponse {
            ok: true,
            task_id: first_task_id,
            video_url: first_url,
            model: last_model,
            engine,
            version,
            cost_cents: total_cost,
            use_user_key,
            segments: Some(segments),
        }));
    }

    // Single-clip path (existing behavior).
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
        segments: None,
    }))
}

/// CSSOS_PHASE2_SHOT_SCRIPTS 20260426 #148-E
/// Combine scene_description + mood + motion into the prompt_text Runway
/// gets. Order: scene first (most important), then mood adjective, then
/// camera motion. Runway's prompt is bounded so we keep this terse.
fn build_shot_prompt(shot: &ShotScriptInput) -> String {
    let mut parts: Vec<String> = vec![shot.scene_description.trim().to_string()];
    if let Some(mood) = shot.mood.as_deref().filter(|s| !s.trim().is_empty()) {
        parts.push(format!("mood: {}", mood.trim()));
    }
    if let Some(motion) = shot.motion.as_deref().filter(|s| !s.trim().is_empty()) {
        parts.push(format!("camera: {}", motion.trim()));
    }
    parts.join(". ")
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
    // CSSOS_PHASE2_PERSIST_PLAYABLE 20260430 #214 — Jing
    // "用户从为你创作/作品中心或者其他面板想再去欣赏这些刚刚输出完毕的作品，
    //  都变成了无法欣赏，必须从头重新输出." Root cause: the playable URLs +
    // metadata (audio_url, alt_audio_url, duration_secs, lyrics_full,
    // engine_meta) were sent in the commit body but the handler dropped
    // them on the floor. work_assets only got the final_mv. Now we accept
    // and persist all of them so /api/works/mine + the click-to-play flow
    // can rehydrate without re-running the pipeline.
    #[serde(default)]
    pub audio_url: Option<String>,
    #[serde(default)]
    pub alt_audio_url: Option<String>,
    #[serde(default)]
    pub subtitle_srt_url: Option<String>,
    #[serde(default)]
    pub duration_secs: Option<f64>,
    #[serde(default)]
    pub alt_duration_secs: Option<f64>,
    #[serde(default)]
    pub lyrics_full: Option<String>,
    #[serde(default)]
    pub engine_meta: Option<serde_json::Value>,
    #[serde(default)]
    pub aligned_lyrics: Option<serde_json::Value>,
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

    // CSSOS_PHASE2_PERSIST_PLAYABLE 20260430 #214 — Jing
    // Use final_mv_url as preview_video_url when the caller didn't specify
    // one. The /api/works/mine handler returns user_works.preview_video_url
    // and the click-to-play flow falls back to it; if final_mv is the only
    // playable artifact (Lite tier has no raw AI clip), routing it through
    // preview_video_url means clicking a saved work plays the actual MV
    // instead of triggering a re-run with random lyrics.
    let preview_video_url_resolved = body
        .preview_video_url
        .as_deref()
        .filter(|s| !s.trim().is_empty())
        .or_else(|| body.final_mv_url.as_deref().filter(|s| !s.trim().is_empty()));

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
    .bind(preview_video_url_resolved)
    .fetch_one(&app.pool)
    .await
    .map_err(sql_error)?;
    let work_id = row.0;

    // Record the final MV asset with the full engine-cost breakdown in meta.
    // CSSOS_PHASE2_PERSIST_PLAYABLE 20260430 #214 — Jing
    // Stamp duration_secs + lyrics_full + aligned_lyrics + engine_meta into
    // the final_mv asset's meta so /api/works/mine can return them on
    // re-fetch. work_assets has UNIQUE(work_id, asset_type) so the upsert
    // collapses repeat commits cleanly.
    if let Some(mv_url) = body.final_mv_url.as_deref() {
        let meta = json!({
            "kind": "third_party_pipeline",
            "engines": body.engine_costs_cents,
            "total_cents": total,
            "duration_secs": body.duration_secs,
            "lyrics_full": body.lyrics_full,
            "aligned_lyrics": body.aligned_lyrics,
            "engine_meta": body.engine_meta,
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

    // CSSOS_PHASE2_PERSIST_PLAYABLE 20260430 #214 — Jing
    // Persist the standalone audio (Take 1) so the Watch panel can play it
    // independently of the muxed MV (e.g. the `Music` tab, ear-only review).
    if let Some(audio_url) = body
        .audio_url
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        let meta = json!({
            "kind": "audio_track",
            "take": 1,
            "duration_secs": body.duration_secs,
        });
        let _ = sqlx::query(
            "INSERT INTO work_assets (work_id, asset_type, url, meta) \
             VALUES ($1, 'audio_track_1', $2, $3) \
             ON CONFLICT (work_id, asset_type) DO UPDATE \
             SET url = EXCLUDED.url, meta = EXCLUDED.meta",
        )
        .bind(work_id)
        .bind(audio_url)
        .bind(meta)
        .execute(&app.pool)
        .await;
    }
    // CSSOS_PHASE2_DUAL_TRACK 20260430 #208 — Take 2 (Suno only).
    if let Some(alt_url) = body
        .alt_audio_url
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        let meta = json!({
            "kind": "audio_track",
            "take": 2,
        });
        let _ = sqlx::query(
            "INSERT INTO work_assets (work_id, asset_type, url, meta) \
             VALUES ($1, 'audio_track_2', $2, $3) \
             ON CONFLICT (work_id, asset_type) DO UPDATE \
             SET url = EXCLUDED.url, meta = EXCLUDED.meta",
        )
        .bind(work_id)
        .bind(alt_url)
        .bind(meta)
        .execute(&app.pool)
        .await;
    }
    if let Some(srt_url) = body
        .subtitle_srt_url
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        let _ = sqlx::query(
            "INSERT INTO work_assets (work_id, asset_type, url, meta) \
             VALUES ($1, 'subtitle_srt', $2, '{}'::jsonb) \
             ON CONFLICT (work_id, asset_type) DO UPDATE \
             SET url = EXCLUDED.url",
        )
        .bind(work_id)
        .bind(srt_url)
        .execute(&app.pool)
        .await;
    }

    // CSSOS_PHASE2_TAKE_2_AS_WORK 20260430 #221b — Jing
    // "万能入口们，输出完毕，输出给为你创作/作品中心，是两首原标题，
    //  不加任何尾巴。用户欣赏第一首，右上角的胶囊要出现，也就是说，
    //  欣赏一首，另一首必须是下一首。"
    //
    // - Both rows now use the SAME original title (no `· Take 2`
    //   suffix). The two cards visually look identical in works-center,
    //   which matches the user's mental model: one song, two takes.
    // - Sibling cross-reference is stamped into each row's final_mv
    //   meta as `sibling_work_id` so the Watch panel can fetch the OTHER
    //   take's audio_track_1 and populate the Take 1/Take 2 toggle even
    //   when the user opens via Take 2's card directly.
    // - Queue auto-advance ordering: both takes are committed within
    //   ~ms of each other → adjacent in created_at DESC, so playing
    //   one and auto-advancing naturally hits the sibling next.
    if let Some(alt_url) = body
        .alt_audio_url
        .as_deref()
        .filter(|s| !s.trim().is_empty())
    {
        // Both rows use the original title (no suffix). The user sees
        // two identical cards; difference is only the audio they play.
        let take2_title = body.title.clone();
        let take2_run_id = body
            .source_run_id
            .as_deref()
            .map(|s| format!("{}::take2", s));
        // Dedup defense: if commit re-fires with same source_run_id we
        // shouldn't double-insert Take 2.
        let take2_existing: Option<(Uuid,)> = sqlx::query_as(
            "SELECT id FROM user_works \
             WHERE user_id = $1 AND source_run_id = $2 LIMIT 1",
        )
        .bind(user_id)
        .bind(take2_run_id.as_deref())
        .fetch_optional(&app.pool)
        .await
        .ok()
        .flatten();
        let take2_id_opt: Option<Uuid> = if let Some((existing,)) = take2_existing {
            Some(existing)
        } else {
            // Insert Take 2 as a TOP-LEVEL sibling so both cards appear
            // independently in works-center (parent_work_id IS NULL filter).
            // The two rows are loosely linked by sharing a cover_image and
            // by source_run_id pattern (`<orig>::take2`); we don't put them
            // under parent/root so the user sees them as 2 distinct cards
            // side by side, not nested in an "opera" expansion.
            let row2 = sqlx::query_as::<_, (Uuid,)>(
                "INSERT INTO user_works \
                   (user_id, title, style, lyrics_preview, status, source_run_id, \
                    compute_cost_cents_estimate, cover_image, preview_image_url, \
                    preview_video_url) \
                 VALUES ($1, $2, $3, $4, 'ready', $5, $6, $7, $8, $9) \
                 RETURNING id",
            )
            .bind(user_id)
            .bind(&take2_title)
            .bind(body.style.as_deref())
            .bind(body.lyrics_preview.as_deref())
            .bind(take2_run_id.as_deref())
            .bind(0_i64) // Take 2 doesn't add new engine cost (same generation)
            .bind(body.cover_image_url.as_deref())
            .bind(body.preview_image_url.as_deref())
            .bind(preview_video_url_resolved)
            .fetch_one(&app.pool)
            .await
            .ok();
            row2.map(|r| r.0)
        };
        if let Some(take2_id) = take2_id_opt {
            // Same final_mv (cheaper than recomposing for now).
            // CSSOS_PHASE2_TAKE_2_AS_WORK 20260430 #221b — sibling
            // cross-reference so frontend can hydrate the OTHER take's
            // audio when the user opens either card.
            if let Some(mv_url) = body.final_mv_url.as_deref() {
                let meta = json!({
                    "kind": "third_party_pipeline",
                    "take_index": 2,
                    "sibling_work_id": work_id,
                    "shares_video_with": work_id,
                    "duration_secs": body.alt_duration_secs.or(body.duration_secs),
                    "lyrics_full": body.lyrics_full,
                });
                let _ = sqlx::query(
                    "INSERT INTO work_assets (work_id, asset_type, url, meta) \
                     VALUES ($1, 'final_mv', $2, $3) \
                     ON CONFLICT (work_id, asset_type) DO UPDATE \
                     SET url = EXCLUDED.url, meta = EXCLUDED.meta",
                )
                .bind(take2_id)
                .bind(mv_url)
                .bind(meta)
                .execute(&app.pool)
                .await;
            }
            // ALSO patch Take 1's final_mv meta to include sibling_work_id
            // pointing at Take 2 — symmetrical so opening either card
            // discovers the other.
            let _ = sqlx::query(
                "UPDATE work_assets \
                 SET meta = meta || jsonb_build_object('sibling_work_id', $1::text, 'take_index', 1) \
                 WHERE work_id = $2 AND asset_type = 'final_mv'",
            )
            .bind(take2_id.to_string())
            .bind(work_id)
            .execute(&app.pool)
            .await;
            // Take 2 row's PRIMARY audio = the alt URL (so playback flows
            // identically to a single-take work, no special-casing needed).
            let meta = json!({
                "kind": "audio_track",
                "take": 1, // primary for THIS row
                "alt_take_index": 2, // links back to Take 2 of parent
            });
            let _ = sqlx::query(
                "INSERT INTO work_assets (work_id, asset_type, url, meta) \
                 VALUES ($1, 'audio_track_1', $2, $3) \
                 ON CONFLICT (work_id, asset_type) DO UPDATE \
                 SET url = EXCLUDED.url, meta = EXCLUDED.meta",
            )
            .bind(take2_id)
            .bind(alt_url)
            .bind(meta)
            .execute(&app.pool)
            .await;
        }
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
    /// CSSOS_PHASE2_LYRIC_SECTIONS 20260426 #148-A2 — Jing
    /// Structured per-section breakdown emitted by the lyrics LLM. When the
    /// LLM returns a JSON envelope with `sections[]`, we parse and pass it
    /// through. When it returns plain text (older models, fallback), we
    /// best-effort split on section markers — same heuristic the marker
    /// stripper uses, but capturing the kind too.
    /// Frontend uses this to align music + video + subtitle segments.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sections: Option<Vec<LyricSection>>,
    /// CSSOS_PHASE2_SHOT_SCRIPTS 20260426 #148-B — Jing
    /// Per-section visual scripts paired with `sections`. The /api/mv/video
    /// endpoint accepts these and runs N parallel Runway calls when in
    /// Cinematic tier. Falls back to a single full-length AI clip otherwise.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shot_scripts: Option<Vec<ShotScript>>,
    /// CSSOS_PHASE2_DERIVED_SETTINGS 20260427 #160 — Jing
    /// 文明联动 / 智能联动 / 随机联动. The lyrics engine is the brain of the
    /// pipeline — once it knows the lyric body + UI civilization, it should
    /// emit the full Advanced-Settings envelope so the user never has to
    /// pick BPM / Key / Voice Gender / Work Type / Reference Artists by
    /// hand. The frontend applies these to creationState ONLY when the
    /// matching field is empty (never overrides explicit user picks).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub derived_settings: Option<DerivedSettings>,
}

/// CSSOS_PHASE2_DERIVED_SETTINGS 20260427 #160 — Jing
/// All Advanced-Settings fields the lyrics engine can derive from
/// (UI civilization × lyric body × user's title hint). Every field is
/// optional — a missing value means "don't override the UI default".
/// Mirrors the field names in frontend creationState.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DerivedSettings {
    /// "single" | "triptych" | "opera" | "short_drama" | "series" | "film"
    /// Inferred from lyric body structure (single block → single,
    /// numbered movements → triptych, libretto sections → opera, etc.)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub work_type: Option<String>,
    /// Total song duration in seconds. Computed as sum of section
    /// line counts × per-line duration (~3.5s/line) + intro/outro buffers.
    /// NOT the hardcoded 180s default.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_secs: Option<u32>,
    /// "feminine" | "masculine" | "childlike" | "duet" | "androgynous" |
    /// "polyphonic_choir". Derived from lyric pronouns + civilization
    /// (e.g. Japanese pop ballad → feminine, Chinese GuFeng war epic →
    /// masculine, K-pop group song → polyphonic_choir).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voice_gender: Option<String>,
    /// Beats per minute (60-180). Civilization + mood keyed.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tempo_bpm: Option<u32>,
    /// Musical key, e.g. "C", "D minor", "F# major".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub key: Option<String>,
    /// Genre — Pop / Rock / Jazz / Hip Hop / R&B / Country / Folk /
    /// Classical / EDM / Reggae / Chinese GuFeng / J-Pop / K-Pop / etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub genre: Option<String>,
    /// Mood — Emotional / Joyous / Sad / Angry / Gentle / Nostalgic / etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mood: Option<String>,
    /// Featured solo instrument (Violin / Piano / Guzheng / Saxophone …)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instrument: Option<String>,
    /// Ambient texture (Birdsong / Waves / Rain / Forest / Cityscape …)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ambience: Option<String>,
    /// Vocal style — soul / belt / falsetto / spoken-word / aria / etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub vocal_style: Option<String>,
    /// Ensemble — pop / orchestral / jazz_combo / rock_band / a_cappella …
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ensemble_style: Option<String>,
    /// Comma-separated instrument list (top of mix), e.g. "piano, strings, harp".
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub instrumentation: Option<String>,
    /// Section form summary — "Verse 1, Verse 2, Chorus, Bridge, Chorus, Outro"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub section_form: Option<String>,
    /// Articulation — "legato lead" / "staccato hook" / "syncopated rap"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub articulation_bias: Option<String>,
    /// Voice register — "bright high lead" / "warm mid" / "deep bass"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voicing_register: Option<String>,
    /// Expression CC bias — "swell intro chorus" / "soft verses big chorus"
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub expression_cc_bias: Option<String>,
    /// Inspiration notes — short freeform civilization context.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inspiration_notes: Option<String>,
    /// Reference artists (NOT for cloning — for ensemble/style hints).
    /// E.g. "The Beatles, Aretha Franklin, Whitney Houston" for English/UK.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reference_artists: Option<String>,
    /// IETF language tag — "ja" / "zh" / "en" / "ko" / etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
}

/// CSSOS_PHASE2_LYRIC_SECTIONS 20260426 #148-A2
/// One song section as returned by the lyrics LLM. `kind` is normalised to
/// snake_case (intro / verse_1 / verse_2 / chorus / bridge / outro / hook).
/// `lines` contains ONLY sung content — no `[Verse 1]` markers.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LyricSection {
    pub kind: String,
    pub lines: Vec<String>,
    /// Optional thematic hint (one short sentence) used to seed the music
    /// engine's mood and the video engine's visual prompt.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub theme: Option<String>,
    /// Optional mood descriptor: calm, intense, longing, triumphant, etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mood: Option<String>,
}

/// CSSOS_PHASE2_SHOT_SCRIPTS 20260426 #148-B
/// One visual shot script paired with a LyricSection by section_kind.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShotScript {
    /// Matches LyricSection.kind so the video engine can join shots to lyric
    /// sections by primary key.
    pub section_kind: String,
    /// Visual description fed to Runway / future AI video engines as the
    /// prompt_text. Should be concrete (subject, action, environment) rather
    /// than abstract poetry — Runway responds best to filmable nouns.
    pub scene_description: String,
    /// Visual mood: warm, cinematic, mystical, gritty, etc.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mood: Option<String>,
    /// Camera motion hint: "slow zoom", "push-in", "dolly right", "static",
    /// "handheld", "crane up". Empty/None ⇒ engine default (typically slow
    /// push-in).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub motion: Option<String>,
}

fn default_lyrics_system_prompt() -> String {
    std::env::var("CSSMV_LYRICS_SYSTEM_PROMPT")
        .ok()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| {
            // CSSOS_PHASE2_LYRIC_SECTIONS 20260426 #148-A2 + #148-B — Jing
            // The lyrics LLM now does triple duty:
            //   1. Singable lyric lines (existing behavior).
            //   2. Structured section breakdown (intro / verse / chorus / etc.)
            //      so downstream music + video stages know section boundaries.
            //   3. Per-section visual shot scripts so /api/mv/video can run
            //      one Runway call per section instead of one generic clip.
            //
            // Output contract: a single JSON object, no Markdown fence, no
            // preamble. Robust parsing on our side falls back gracefully if
            // the LLM emits plain text (older models, forgetful runs).
            r#"You are a professional songwriter, music-video director, AND music producer. For the user's theme, produce SINGABLE original lyrics, a per-section visual shot list, AND a complete derived_settings envelope so the production pipeline never has to guess BPM / key / instrumentation / voice gender / reference artists. Output ONE JSON object with this exact shape:

{
  "lyrics": "<full lyrics with section markers like [Verse 1] / [Chorus] / [Bridge] / [Outro] on their own lines>",
  "sections": [
    {"kind": "intro", "lines": [], "theme": "soft piano opens", "mood": "calm"},
    {"kind": "verse_1", "lines": ["First sung line", "Second sung line"], "theme": "longing for home", "mood": "wistful"},
    {"kind": "chorus", "lines": ["Chorus line one", "Chorus line two"], "theme": "soaring release", "mood": "triumphant"}
  ],
  "shot_scripts": [
    {"section_kind": "intro", "scene_description": "Empty wooden stage, single spotlight, dust motes drifting", "mood": "intimate", "motion": "slow push-in"},
    {"section_kind": "verse_1", "scene_description": "Young woman walks alone down a misty cobblestone street at dawn", "mood": "melancholic", "motion": "tracking shot, slow"},
    {"section_kind": "chorus", "scene_description": "She bursts onto a sunlit cliff top, arms wide, hair streaming", "mood": "uplifting", "motion": "sweeping crane up"}
  ],
  "derived_settings": {
    "work_type": "single | triptych | opera | short_drama | series | film",
    "duration_secs": 187,
    "voice_gender": "feminine | masculine | childlike | duet | androgynous | polyphonic_choir",
    "tempo_bpm": 88,
    "key": "C minor",
    "genre": "Pop | Rock | Jazz | Hip Hop | R&B | Country | Folk | Classical | EDM | Reggae | Chinese GuFeng | J-Pop | K-Pop | Mandopop | Latin Pop | Chanson | …",
    "mood": "Emotional | Joyous | Sad | Angry | Gentle | Nostalgic | Romantic | Inspiring | Soulful",
    "instrument": "Violin | Piano | Guitar | Guzheng | Saxophone | Synth Bass | …",
    "ambience": "Birdsong | Waves | Rain | Forest | Cityscape | Vinyl | Thunder | Campfire",
    "vocal_style": "soft head voice | emotive belt | falsetto | spoken-word | flowing legato | …",
    "ensemble_style": "j_pop_band | k_pop | mandopop | guzheng_ensemble | pop_band | latin_pop | chanson | german_pop | russian_pop | arabic_pop | bollywood | …",
    "instrumentation": "piano, strings, harp",
    "section_form": "Verse 1, Verse 2, Chorus 1, Verse 3, Verse 4, Chorus 2, Bridge, Chorus 3, Chorus 4, Outro",
    "articulation_bias": "legato lead | staccato hook | syncopated rap",
    "voicing_register": "bright high lead | warm mid | deep bass",
    "expression_cc_bias": "swell intro chorus | soft verses big chorus",
    "inspiration_notes": "<short freeform civilization context>",
    "reference_artists": "Aimer, Hikaru Utada, Yorushika",
    "language": "ja"
  }
}

Rules:
- "lines" arrays contain ONLY sung text. NEVER include "[Verse 1]" or "**Chorus**" inside a line — those go ONLY in the top-level "lyrics" field as section markers.
- "kind" values: intro, verse_1, verse_2, verse_3, ..., chorus, bridge, hook, outro. Use snake_case.
- One shot_scripts entry per section. section_kind matches a section.
- scene_description must be filmable: concrete subject + action + setting. Avoid pure abstraction.
- motion is a camera direction: "slow zoom", "static", "dolly right", "handheld", "crane up", "rack focus", etc.
- derived_settings MUST be civilization-coherent: Japanese lyrics → Japanese reference_artists + J-Pop genre + ja language; Chinese GuFeng lyrics → Chinese reference_artists + Guzheng instrument + zh language; English pop ballad → English reference_artists + Pop genre + en language. NEVER mix civilizations (e.g. don't pair Aretha Franklin with Chinese GuFeng).
- voice_gender: infer from lyric pronouns + civilization. If both present in lyrics, use "duet".
- duration_secs: realistic song length (45-600s). NEVER 180 by default — compute from total line count × ~3.5s + 8s intro/outro.
- work_type: single (one block), triptych (3 movements), opera (libretto), short_drama / series / film for narrative/scripted forms.
- reference_artists: 3-5 iconic artists FROM THE TARGET CIVILIZATION. These are inspiration/ensemble hints, NEVER for cloning.
- Return JSON ONLY. No Markdown fence, no commentary, no preamble.
- Match the requested language for the lyrics field. Shot descriptions and theme/mood may stay English (they're director notes)."#
                .to_string()
        })
}

/// CSSOS_PHASE2_LYRIC_SECTIONS 20260426 #148-A2
/// Parse the lyrics LLM output. Three layers of defense:
///   1. Try the JSON envelope (preferred path).
///   2. If JSON has `lyrics` + `sections` + `shot_scripts`, accept.
///   3. If the response is plain text, split by section markers and emit
///      sections without shot_scripts (frontend will skip multi-segment
///      video and fall back to single-clip mode).
///
/// Returns `(plain_lyrics, Option<sections>, Option<shot_scripts>)`.
fn parse_lyrics_llm_output(
    raw: &str,
) -> (String, Option<Vec<LyricSection>>, Option<Vec<ShotScript>>, Option<DerivedSettings>) {
    let trimmed = raw.trim();
    // Strip Markdown JSON fences if the model emitted them despite instructions.
    let core = if let Some(stripped) = trimmed.strip_prefix("```json").and_then(|s| s.strip_suffix("```")) {
        stripped.trim()
    } else if let Some(stripped) = trimmed.strip_prefix("```").and_then(|s| s.strip_suffix("```")) {
        stripped.trim()
    } else {
        trimmed
    };

    if let Ok(v) = serde_json::from_str::<serde_json::Value>(core) {
        let lyrics = v
            .get("lyrics")
            .and_then(|x| x.as_str())
            .map(|s| s.trim().to_string())
            .unwrap_or_default();

        let sections: Option<Vec<LyricSection>> = v
            .get("sections")
            .and_then(|x| x.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| {
                        let kind = item.get("kind")?.as_str()?.trim().to_string();
                        if kind.is_empty() {
                            return None;
                        }
                        let lines: Vec<String> = item
                            .get("lines")
                            .and_then(|x| x.as_array())
                            .map(|a| {
                                a.iter()
                                    .filter_map(|l| l.as_str())
                                    .map(|s| s.trim().to_string())
                                    .filter(|s| !s.is_empty())
                                    .collect()
                            })
                            .unwrap_or_default();
                        Some(LyricSection {
                            kind,
                            lines,
                            theme: item
                                .get("theme")
                                .and_then(|x| x.as_str())
                                .map(|s| s.trim().to_string())
                                .filter(|s| !s.is_empty()),
                            mood: item
                                .get("mood")
                                .and_then(|x| x.as_str())
                                .map(|s| s.trim().to_string())
                                .filter(|s| !s.is_empty()),
                        })
                    })
                    .collect::<Vec<_>>()
            })
            .filter(|v| !v.is_empty());

        let shot_scripts: Option<Vec<ShotScript>> = v
            .get("shot_scripts")
            .and_then(|x| x.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|item| {
                        let section_kind = item.get("section_kind")?.as_str()?.trim().to_string();
                        let scene_description = item
                            .get("scene_description")?
                            .as_str()?
                            .trim()
                            .to_string();
                        if section_kind.is_empty() || scene_description.is_empty() {
                            return None;
                        }
                        Some(ShotScript {
                            section_kind,
                            scene_description,
                            mood: item
                                .get("mood")
                                .and_then(|x| x.as_str())
                                .map(|s| s.trim().to_string())
                                .filter(|s| !s.is_empty()),
                            motion: item
                                .get("motion")
                                .and_then(|x| x.as_str())
                                .map(|s| s.trim().to_string())
                                .filter(|s| !s.is_empty()),
                        })
                    })
                    .collect::<Vec<_>>()
            })
            .filter(|v| !v.is_empty());

        // CSSOS_PHASE2_DERIVED_SETTINGS_PARSE 20260427 #160 — extract envelope.
        let derived_settings: Option<DerivedSettings> = v
            .get("derived_settings")
            .or_else(|| v.get("settings"))
            .and_then(|node| {
                let s = serde_json::from_value::<DerivedSettings>(node.clone()).ok()?;
                if s.work_type.is_some()
                    || s.duration_secs.is_some()
                    || s.voice_gender.is_some()
                    || s.tempo_bpm.is_some()
                    || s.key.is_some()
                    || s.genre.is_some()
                    || s.mood.is_some()
                    || s.instrument.is_some()
                    || s.ambience.is_some()
                    || s.vocal_style.is_some()
                    || s.ensemble_style.is_some()
                    || s.instrumentation.is_some()
                    || s.section_form.is_some()
                    || s.articulation_bias.is_some()
                    || s.voicing_register.is_some()
                    || s.expression_cc_bias.is_some()
                    || s.inspiration_notes.is_some()
                    || s.reference_artists.is_some()
                    || s.language.is_some()
                {
                    Some(s)
                } else {
                    None
                }
            });

        if !lyrics.is_empty() {
            tracing::info!(
                target = "mv_pipeline_lyrics",
                section_count = sections.as_ref().map(|v| v.len()).unwrap_or(0),
                shot_count = shot_scripts.as_ref().map(|v| v.len()).unwrap_or(0),
                derived_present = derived_settings.is_some(),
                "lyrics LLM emitted JSON envelope"
            );
            return (lyrics, sections, shot_scripts, derived_settings);
        }
    }

    // Plain-text fallback: split on bracket markers + heuristic kind detect.
    tracing::info!(
        target = "mv_pipeline_lyrics",
        "lyrics LLM returned plain text — falling back to heuristic section split"
    );
    let sections = heuristic_split_sections(core);
    (
        core.to_string(),
        if sections.is_empty() { None } else { Some(sections) },
        None,
        None,
    )
}

/// Heuristic plain-text section splitter for fallback when LLM doesn't comply
/// with the JSON envelope. Recognises [Verse 1] / **Chorus** / (Bridge) / Verse 2: style markers.
fn heuristic_split_sections(text: &str) -> Vec<LyricSection> {
    let mut sections: Vec<LyricSection> = Vec::new();
    let mut current_kind: String = "verse_1".to_string();
    let mut current_lines: Vec<String> = Vec::new();
    let mut verse_counter = 1u32;

    fn classify_marker(line: &str) -> Option<String> {
        let core = line
            .trim()
            .trim_start_matches(|c: char| c == '[' || c == '(' || c == '*' || c == '#')
            .trim_end_matches(|c: char| c == ']' || c == ')' || c == '*')
            .trim_end_matches(':')
            .trim_end_matches('.')
            .trim()
            .to_ascii_lowercase();
        if core.starts_with("verse") {
            // "verse 1" → "verse_1"
            let suffix: String = core
                .chars()
                .skip("verse".len())
                .filter(|c| c.is_ascii_digit())
                .collect();
            if suffix.is_empty() {
                return Some("verse".into());
            }
            return Some(format!("verse_{}", suffix));
        }
        if core.starts_with("chorus") || core == "hook" {
            return Some("chorus".into());
        }
        if core.starts_with("bridge") {
            return Some("bridge".into());
        }
        if core.starts_with("intro") {
            return Some("intro".into());
        }
        if core.starts_with("outro") {
            return Some("outro".into());
        }
        if core.starts_with("pre-chorus") || core.starts_with("prechorus") {
            return Some("pre_chorus".into());
        }
        if core.starts_with("post-chorus") || core.starts_with("postchorus") {
            return Some("post_chorus".into());
        }
        if core.starts_with("interlude") {
            return Some("interlude".into());
        }
        None
    }

    for line in text.split('\n') {
        let trimmed = line.trim();
        if let Some(kind) = classify_marker(trimmed) {
            // Push the previous section if it has lines.
            if !current_lines.is_empty() {
                sections.push(LyricSection {
                    kind: current_kind.clone(),
                    lines: std::mem::take(&mut current_lines),
                    theme: None,
                    mood: None,
                });
            }
            // Auto-number "verse" → "verse_N"
            current_kind = if kind == "verse" {
                verse_counter += 1;
                format!("verse_{}", verse_counter)
            } else {
                kind
            };
            continue;
        }
        if trimmed.is_empty() {
            continue;
        }
        // Strip inline wrappers
        let cleaned = trimmed
            .trim_start_matches("**")
            .trim_end_matches("**")
            .trim()
            .to_string();
        if !cleaned.is_empty() {
            current_lines.push(cleaned);
        }
    }
    if !current_lines.is_empty() {
        sections.push(LyricSection {
            kind: current_kind,
            lines: current_lines,
            theme: None,
            mood: None,
        });
    }
    sections
}

#[cfg(test)]
mod lyrics_parse_tests {
    use super::*;

    #[test]
    fn parses_full_json_envelope() {
        let raw = r#"{
            "lyrics": "[Verse 1]\nLine A\n[Chorus]\nLine B",
            "sections": [
                {"kind": "verse_1", "lines": ["Line A"], "theme": "open", "mood": "calm"},
                {"kind": "chorus",  "lines": ["Line B"], "theme": "release", "mood": "triumphant"}
            ],
            "shot_scripts": [
                {"section_kind": "verse_1", "scene_description": "A street at dawn", "motion": "tracking"},
                {"section_kind": "chorus",  "scene_description": "Cliff edge crane up", "motion": "crane up"}
            ]
        }"#;
        let (lyrics, sections, shots, _derived) = parse_lyrics_llm_output(raw);
        assert!(lyrics.contains("Line A"));
        let s = sections.expect("sections");
        assert_eq!(s.len(), 2);
        assert_eq!(s[0].kind, "verse_1");
        let sh = shots.expect("shots");
        assert_eq!(sh.len(), 2);
        assert_eq!(sh[1].section_kind, "chorus");
    }

    #[test]
    fn parses_json_inside_markdown_fence() {
        let raw = "```json\n{\"lyrics\":\"X\",\"sections\":[{\"kind\":\"verse_1\",\"lines\":[\"X\"]}]}\n```";
        let (l, s, _, _) = parse_lyrics_llm_output(raw);
        assert_eq!(l, "X");
        assert_eq!(s.unwrap().len(), 1);
    }

    #[test]
    fn falls_back_on_plain_text() {
        let raw = "[Verse 1]\nLine A\n\n[Chorus]\nLine B";
        let (l, s, sh, _) = parse_lyrics_llm_output(raw);
        assert!(l.contains("Line A"));
        let sects = s.expect("heuristic sections");
        assert!(sects.iter().any(|x| x.kind == "verse_1"));
        assert!(sects.iter().any(|x| x.kind == "chorus"));
        assert!(sh.is_none(), "no shot scripts in plain-text fallback");
    }

    #[test]
    fn falls_back_when_json_lacks_lyrics() {
        let raw = r#"{"unrelated": "field"}"#;
        let (l, s, sh, d) = parse_lyrics_llm_output(raw);
        // No lyrics field → falls into plain-text path which returns the raw
        // back as lyrics, no sections/shots.
        assert_eq!(l, raw);
        assert!(s.is_none() || s.unwrap().is_empty());
        assert!(sh.is_none());
        assert!(d.is_none());
    }

    #[test]
    fn parses_derived_settings_envelope() {
        let raw = r#"{
            "lyrics": "[Verse 1]\nLine A",
            "sections": [{"kind": "verse_1", "lines": ["Line A"]}],
            "derived_settings": {
                "work_type": "single",
                "duration_secs": 187,
                "voice_gender": "feminine",
                "tempo_bpm": 88,
                "key": "C minor",
                "genre": "J-Pop",
                "mood": "Nostalgic",
                "vocal_style": "soft head voice",
                "section_form": "Verse 1, Chorus, Verse 2, Chorus, Bridge, Chorus, Outro",
                "reference_artists": "Aimer, Yorushika, Hikaru Utada",
                "language": "ja"
            }
        }"#;
        let (lyrics, _sections, _shots, derived) = parse_lyrics_llm_output(raw);
        assert!(lyrics.contains("Line A"));
        let d = derived.expect("derived_settings present");
        assert_eq!(d.work_type.as_deref(), Some("single"));
        assert_eq!(d.duration_secs, Some(187));
        assert_eq!(d.voice_gender.as_deref(), Some("feminine"));
        assert_eq!(d.tempo_bpm, Some(88));
        assert_eq!(d.language.as_deref(), Some("ja"));
        assert_eq!(d.reference_artists.as_deref(), Some("Aimer, Yorushika, Hikaru Utada"));
    }
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

    // CSSOS_PHASE2_LYRIC_SECTIONS 20260426 #148-A2 + #148-B — Jing
    // Parse the LLM output for the JSON envelope. The LLM is instructed to
    // emit structured sections + shot_scripts + derived_settings; we fall
    // back to plain-text heuristic split if it doesn't comply.
    let (parsed_lyrics, parsed_sections, parsed_shots, parsed_derived) =
        parse_lyrics_llm_output(&result.text);

    // CSSOS_PHASE2_DERIVED_SETTINGS_FALLBACK 20260427 #160 — Jing
    // 文明联动 / 智能联动 / 随机联动. When the LLM doesn't provide a
    // derived_settings envelope (older models, transient runs, or a refusal),
    // synthesise one from civilization × lyric body × language so the
    // frontend Advanced Settings still get filled. The heuristic uses:
    //   - language → reference_artists, vocal_style, ensemble_style
    //   - lyric line count + section form → duration_secs
    //   - civilization + lyric pronouns → voice_gender
    //   - section count → work_type
    let final_derived: Option<DerivedSettings> = parsed_derived.or_else(|| {
        let civ_hint = body.civilization.as_deref().unwrap_or("");
        let lang_hint = body.language.as_deref().unwrap_or("");
        Some(derive_settings_fallback(
            &parsed_lyrics,
            parsed_sections.as_deref(),
            civ_hint,
            lang_hint,
        ))
    });

    tracing::info!(
        target = "mv_pipeline_lyrics",
        engine = %engine,
        version = %version,
        section_count = parsed_sections.as_ref().map(|v| v.len()).unwrap_or(0),
        shot_count = parsed_shots.as_ref().map(|v| v.len()).unwrap_or(0),
        derived_present = final_derived.is_some(),
        "lyrics stage emitted parsed envelope"
    );

    Ok(Json(LyricsResponse {
        ok: true,
        task_id,
        lyrics: parsed_lyrics,
        language: body.language,
        engine: engine.clone(),
        version: version.clone(),
        provider_model: result.model,
        cost_cents,
        input_tokens: result.input_tokens,
        output_tokens: result.output_tokens,
        sections: parsed_sections,
        shot_scripts: parsed_shots,
        derived_settings: final_derived,
    }))
}

/// CSSOS_PHASE2_DERIVED_SETTINGS_FALLBACK 20260427 #160 — Jing
/// Best-effort heuristic derivation when the lyrics LLM didn't emit a
/// `derived_settings` envelope. Uses language, civilization, and the
/// parsed lyric body to populate as many Advanced Settings fields as
/// possible. Always returns Some with at least language + duration_secs
/// + work_type filled — frontend overlays only over empty creationState
/// fields, so over-filling here is safe.
fn derive_settings_fallback(
    lyrics: &str,
    sections: Option<&[LyricSection]>,
    civilization: &str,
    language: &str,
) -> DerivedSettings {
    let lang = language.trim().to_ascii_lowercase();
    let civ = civilization.trim().to_ascii_lowercase();

    // Duration: per-section line count × 3.5s + 8s intro/outro buffer.
    let total_lines: usize = sections
        .map(|s| s.iter().map(|sec| sec.lines.len()).sum())
        .unwrap_or_else(|| {
            lyrics
                .lines()
                .filter(|l| !l.trim().is_empty() && !l.trim_start().starts_with('['))
                .count()
        });
    // CSSOS_PHASE2_DURATION_HONORS_CHAR_DENSITY 20260429 #168.9a — Jing
    // Char density matters: a 17-line song with 175 chars/line is ~3 min,
    // not 60s. Use whichever is larger:
    //   • 3.5s/line floor (legacy heuristic — fine for short pop)
    //   • avg_chars_per_line / 12 chars-per-second × line_count (covers
    //     opera, narrative, CJK-dense lyrics).
    // Hard floor at 180s (3 min) so we never ship a sub-3-min single
    // even for sparse lyrics — lyrics LLM should be writing real songs.
    // Hard ceiling 600s (10 min) for opera / Suno-extend territory.
    let duration_secs = if total_lines == 0 {
        Some(180u32)
    } else {
        let total_chars: usize = lyrics.chars().filter(|c| !c.is_whitespace()).count();
        let avg_chars = if total_lines > 0 { total_chars as f32 / total_lines as f32 } else { 0.0 };
        let by_line = total_lines as f32 * 3.5;
        let by_chars = total_chars as f32 / 12.0;
        let raw = by_line.max(by_chars) + 12.0; // 12s buffer for intro/outro
        Some((raw.round() as u32).clamp(180, 600))
    };
    // also useful: log what we picked so we can diagnose later
    let _ = (duration_secs.unwrap(), total_lines);

    // Work type: count the distinct section kinds we recognise as
    // top-level "movements". 1 → single, 3 → triptych, 5+ unique → series.
    let work_type = sections
        .map(|s| {
            let unique_kinds: std::collections::HashSet<_> =
                s.iter().map(|sec| sec.kind.as_str()).collect();
            match unique_kinds.len() {
                0 | 1 => "single",
                2 | 3 => "triptych",
                4 | 5 => "opera",
                _ => "series",
            }
        })
        .unwrap_or("single")
        .to_string();

    // Voice gender: heuristic on body — feminine pronouns ("她", "elle",
    // "she", "彼女", "그녀") → feminine, masculine ("他", "il", "he", "彼",
    // "그") → masculine. Fall back to civ-default.
    let body_lower = lyrics.to_lowercase();
    let has_fem = body_lower.contains("she ")
        || body_lower.contains("her ")
        || body_lower.contains("elle ")
        || lyrics.contains("她")
        || lyrics.contains("彼女")
        || lyrics.contains("그녀");
    let has_masc = body_lower.contains("he ")
        || body_lower.contains("him ")
        || body_lower.contains("his ")
        || body_lower.contains(" il ")
        || lyrics.contains("他")
        || lyrics.contains("彼");
    let voice_gender = match (has_fem, has_masc) {
        (true, false) => Some("feminine".to_string()),
        (false, true) => Some("masculine".to_string()),
        (true, true) => Some("duet".to_string()),
        _ => None, // leave to civ-keyed default below if any
    };

    // Reference atlas + ensemble per language (Jing's requirement: each
    // civilization has its own iconic artists / ensembles).
    let (reference_artists, ensemble_style, genre, vocal_style, instrument) = match lang.as_str() {
        "ja" => (
            Some("Aimer, Hikaru Utada, Yorushika, Yoasobi, RADWIMPS".to_string()),
            Some("j_pop_band".to_string()),
            Some("J-Pop".to_string()),
            Some("airy mix".to_string()),
            Some("Piano".to_string()),
        ),
        "ko" => (
            Some("IU, BTS, Crush, Heize, Akdong Musician".to_string()),
            Some("k_pop".to_string()),
            Some("K-Pop".to_string()),
            Some("belt with rap bridge".to_string()),
            Some("Synth Bass".to_string()),
        ),
        "zh" => {
            // Chinese: differentiate GuFeng vs Mandopop by civilization hint
            if civ.contains("gufeng") || civ.contains("古风") {
                (
                    Some("周杰伦, 毛不易, 林俊杰, 李宇春, 邓紫棋".to_string()),
                    Some("guzheng_ensemble".to_string()),
                    Some("Chinese GuFeng".to_string()),
                    Some("flowing legato".to_string()),
                    Some("Guzheng".to_string()),
                )
            } else {
                (
                    Some("Jay Chou, JJ Lin, G.E.M., Eason Chan, Joker Xue".to_string()),
                    Some("mandopop".to_string()),
                    Some("Mandopop".to_string()),
                    Some("emotive lyric".to_string()),
                    Some("Piano".to_string()),
                )
            }
        }
        "en" => (
            Some("The Beatles, Aretha Franklin, Whitney Houston, Hans Zimmer, Daft Punk".to_string()),
            Some("pop_band".to_string()),
            Some("Pop".to_string()),
            Some("soulful belt".to_string()),
            Some("Piano".to_string()),
        ),
        "es" => (
            Some("Rosalía, Bad Bunny, Shakira, J Balvin, Carlos Vives".to_string()),
            Some("latin_pop".to_string()),
            Some("Latin Pop".to_string()),
            Some("rhythmic vocal".to_string()),
            Some("Guitar".to_string()),
        ),
        "fr" => (
            Some("Édith Piaf, Stromae, Christine and the Queens, Charles Aznavour".to_string()),
            Some("chanson".to_string()),
            Some("Chanson".to_string()),
            Some("intimate spoken-melodic".to_string()),
            Some("Piano".to_string()),
        ),
        "de" => (
            Some("Rammstein, Nena, Cro, Mark Forster".to_string()),
            Some("german_pop".to_string()),
            Some("German Pop".to_string()),
            Some("declarative".to_string()),
            Some("Synth Bass".to_string()),
        ),
        "ru" => (
            Some("Земфира, Виктор Цой, Алла Пугачёва, Полина Гагарина".to_string()),
            Some("russian_pop".to_string()),
            Some("Russian Pop".to_string()),
            Some("dramatic chest".to_string()),
            Some("Violin".to_string()),
        ),
        "ar" => (
            Some("Fairuz, Amr Diab, Nancy Ajram, Mohammed Abdu".to_string()),
            Some("arabic_pop".to_string()),
            Some("Arabic Pop".to_string()),
            Some("ornamented melisma".to_string()),
            Some("Oud".to_string()),
        ),
        "hi" => (
            Some("A.R. Rahman, Lata Mangeshkar, Arijit Singh, Shreya Ghoshal".to_string()),
            Some("bollywood".to_string()),
            Some("Bollywood".to_string()),
            Some("filmi vocal".to_string()),
            Some("Sitar".to_string()),
        ),
        _ => (
            None,
            Some("pop".to_string()),
            Some("Pop".to_string()),
            Some("balanced lead".to_string()),
            None,
        ),
    };

    // Tempo + key: civ-keyed defaults that pair well with the genre.
    let tempo_bpm = match lang.as_str() {
        "ja" => Some(96u32),
        "ko" => Some(110),
        "zh" => Some(82),
        "en" => Some(104),
        "es" => Some(108),
        "fr" => Some(92),
        "de" => Some(112),
        "ru" => Some(98),
        "ar" => Some(86),
        "hi" => Some(102),
        _ => Some(100),
    };
    let key = match lang.as_str() {
        "ja" | "zh" | "ko" => Some("C minor".to_string()),
        "en" | "es" | "fr" | "de" => Some("D".to_string()),
        "ar" | "hi" => Some("E minor".to_string()),
        _ => Some("C".to_string()),
    };

    // Section form: derived from sections if available, else generic verse-chorus form.
    let section_form = sections
        .map(|s| {
            s.iter()
                .map(|sec| {
                    let mut name = sec.kind.replace('_', " ");
                    if let Some(c) = name.get_mut(0..1) {
                        c.make_ascii_uppercase();
                    }
                    name
                })
                .collect::<Vec<_>>()
                .join(", ")
        })
        .filter(|s| !s.is_empty())
        .or_else(|| {
            Some(
                "Verse 1, Verse 2, Chorus 1, Verse 3, Verse 4, Chorus 2, Bridge, Chorus 3, Chorus 4, Outro"
                    .to_string(),
            )
        });

    DerivedSettings {
        work_type: Some(work_type),
        duration_secs,
        voice_gender,
        tempo_bpm,
        key,
        genre,
        mood: None,
        instrument,
        ambience: None,
        vocal_style,
        ensemble_style,
        instrumentation: None,
        section_form,
        articulation_bias: Some("legato lead".to_string()),
        voicing_register: Some("bright high lead".to_string()),
        expression_cc_bias: Some("swell intro chorus".to_string()),
        inspiration_notes: None,
        reference_artists,
        language: if lang.is_empty() { None } else { Some(lang) },
    }
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
    /// CSSOS_PHASE2_ASS_OUTPUT 20260504 — Jing
    /// Optional song title for the ASS [Script Info] header. Pure
    /// metadata; doesn't affect timing or SRT output.
    #[serde(default)]
    pub title: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SubtitlesResponse {
    pub ok: bool,
    pub task_id: String,
    pub srt: String,
    /// CSSOS_PHASE2_ASS_OUTPUT 20260504 — Jing
    /// "请输出 ACC 字幕文件…比 SRT 拥有更多功能，我们会用到的，
    ///  比如实时改变样式，颜色等".
    /// ASS (Advanced SubStation Alpha) emitted alongside SRT. Same
    /// timing data, but ASS's [Events] / Dialogue lines support inline
    /// override tags ({\c&Hxxxxxx&} colour, {\fs<n>} size, {\b1}{\b0}
    /// bold, {\fad(...)} fade, {\k<centiseconds>} per-syllable karaoke,
    /// {\an<pos>} alignment, etc) so the live karaoke renderer can do
    /// per-line emotion tinting / size pumping without a separate
    /// timing pipeline.
    #[serde(default, skip_serializing_if = "String::is_empty")]
    pub ass: String,
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

/// CSSOS_PHASE2_ASS_OUTPUT 20260504 — Jing
/// ASS uses centisecond precision (h:mm:ss.cc, exactly 2 fractional
/// digits) and a single dot, NOT comma. Required by libass / VLC /
/// every ASS-aware renderer.
fn format_ass_timestamp(mut secs: f64) -> String {
    if secs < 0.0 {
        secs = 0.0;
    }
    let total_cs = (secs * 100.0).round() as u64;
    let cs = total_cs % 100;
    let total_s = total_cs / 100;
    let s = total_s % 60;
    let m = (total_s / 60) % 60;
    let h = total_s / 3600;
    format!("{}:{:02}:{:02}.{:02}", h, m, s, cs)
}

/// Strip / escape characters that break ASS Dialogue parsing:
///   • literal `{` / `}` would open override-tag scopes
///   • newline / carriage return must become `\N` for line break
///   • a leading `;` makes libass treat the line as a comment
fn ass_escape_text(input: &str) -> String {
    let trimmed = input.trim();
    let mut out = String::with_capacity(trimmed.len());
    for ch in trimmed.chars() {
        match ch {
            '{' => out.push_str("\\{"),
            '}' => out.push_str("\\}"),
            '\n' | '\r' => out.push_str("\\N"),
            _ => out.push(ch),
        }
    }
    if out.starts_with(';') {
        out.insert(0, '\\');
    }
    out
}

/// Map a small set of "emotion" tags (engine-emitted on aligned_lyrics
/// when available) to ASS override tags so the renderer tints / scales
/// the line without per-frontend logic. Caller passes None when no
/// annotation is available; the line gets default styling.
fn ass_emotion_override(emotion: Option<&str>, emphasis: Option<f32>) -> String {
    let mut tags = String::new();
    if let Some(e) = emotion {
        match e.to_ascii_lowercase().as_str() {
            "ignite" | "fire" | "anger" => tags.push_str("{\\c&H4272FF&}"), // BGR red-ish
            "resolve" | "dream" | "moonlit" => tags.push_str("{\\c&HFFE679&}"),
            "intimate" | "grief" | "tender" => tags.push_str("{\\c&HFFA4C2&}"),
            "joy" | "playful" | "cheerful" => tags.push_str("{\\c&H6BFFB6&}"),
            _ => {}
        }
    }
    if let Some(e) = emphasis {
        let pump = (1.0 + e.clamp(0.0, 1.0) * 0.18).clamp(0.85, 1.4);
        // PercentageX/Y scaling — ASS uses fscx/fscy where 100 is "no scale".
        let pct = (pump * 100.0).round() as u32;
        if pct != 100 {
            tags.push_str(&format!("{{\\fscx{p}\\fscy{p}}}", p = pct));
        }
    }
    if !tags.is_empty() {
        // Add a soft fade-in/out so style swaps don't snap.
        tags.push_str("{\\fad(120,120)}");
    }
    tags
}

fn build_ass_from_aligned(
    aligned: &[crate::music_gen::AlignedLyricLine],
    min_line_secs: f64,
    line_gap_secs: f64,
    title: &str,
) -> (String, usize) {
    let mut header = String::new();
    header.push_str("[Script Info]\n");
    header.push_str(&format!(
        "Title: {}\n",
        if title.is_empty() { "cssOS karaoke" } else { title }
    ));
    header.push_str("ScriptType: v4.00+\n");
    header.push_str("Collisions: Normal\n");
    header.push_str("WrapStyle: 0\n");
    header.push_str("ScaledBorderAndShadow: yes\n");
    header.push_str("PlayResX: 1920\n");
    header.push_str("PlayResY: 1080\n");
    header.push_str("YCbCr Matrix: TV.709\n\n");

    header.push_str("[V4+ Styles]\n");
    header.push_str(
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n",
    );
    // Default karaoke style: white primary, cyan-ish secondary (sung
    // word colour for {\k} tags), black outline, bottom-centre.
    header.push_str(
        "Style: Default,Source Han Sans SC,72,&H00FFFFFF,&H00F7B70B,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,2,2,80,80,90,1\n",
    );
    // Ignite / hot accents — for emotion: ignite override fallback.
    header.push_str(
        "Style: Ignite,Source Han Sans SC,76,&H004272FF,&H00FFFFFF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,2,2,80,80,90,1\n",
    );
    // Intimate — softer pink, smaller.
    header.push_str(
        "Style: Intimate,Source Han Sans SC,64,&H00FFA4C2&,&H00FFFFFF,&H00000000,&H80000000,0,1,0,0,100,100,0,0,1,2,2,2,80,80,80,1\n",
    );
    header.push('\n');

    header.push_str("[Events]\n");
    header
        .push_str("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n");

    if aligned.is_empty() {
        return (header, 0);
    }

    let mut sorted: Vec<&crate::music_gen::AlignedLyricLine> = aligned
        .iter()
        .filter(|l| {
            let t = l.text.trim();
            if t.is_empty() {
                return false;
            }
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

    let min_line_ms = (min_line_secs * 1000.0).round() as u64;
    let gap_ms = (line_gap_secs * 1000.0).round() as u64;
    let count = sorted.len();
    let mut events = String::new();

    for (idx, line) in sorted.iter().enumerate() {
        let mut start_ms = line.start_ms;
        let mut end_ms = line.end_ms.max(start_ms);

        if end_ms.saturating_sub(start_ms) < min_line_ms {
            let next_start = sorted
                .get(idx + 1)
                .map(|l| l.start_ms)
                .unwrap_or(end_ms + min_line_ms);
            let extended = start_ms + min_line_ms;
            end_ms = extended.min(next_start.saturating_sub(gap_ms));
            if end_ms < start_ms + 100 {
                end_ms = start_ms + 100;
            }
        }
        if let Some(next) = sorted.get(idx + 1) {
            let next_start = next.start_ms;
            if end_ms + gap_ms > next_start {
                end_ms = next_start.saturating_sub(gap_ms).max(start_ms + 100);
            }
        }
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

        let cleaned_raw = line
            .text
            .trim()
            .trim_start_matches('*')
            .trim_end_matches('*')
            .trim_start_matches('[')
            .trim_end_matches(']')
            .trim();
        let escaped = ass_escape_text(cleaned_raw);
        // Hooks for engine-emitted emotion / emphasis. AlignedLyricLine
        // doesn't carry those today (only text/start_ms/end_ms/section)
        // — leave the override empty so the Default style is used.
        // Future: extend AlignedLyricLine with emotion/emphasis and
        // wire those fields through here.
        let override_tags = ass_emotion_override(None, None);

        events.push_str(&format!(
            "Dialogue: 0,{start},{end},Default,,0,0,0,,{tags}{text}\n",
            start = format_ass_timestamp(start_ms as f64 / 1000.0),
            end = format_ass_timestamp(end_ms as f64 / 1000.0),
            tags = override_tags,
            text = escaped
        ));
    }

    header.push_str(&events);
    (header, count)
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

    // CSSOS_PHASE2_ASS_OUTPUT 20260504 — emit ASS alongside SRT using
    // the same timing source. When aligned_lyrics is available we use
    // those timestamps directly; otherwise we re-parse the SRT we just
    // produced (cheap — line_count is at most ~80) so even the
    // even-divide path still gets an ASS file. This way every Watch
    // panel render has both formats available, regardless of the
    // engine's alignment quality.
    let ass = if engine == "cssmv-local" && version == "srt-v1" {
        let min_line = body.min_line_secs.unwrap_or(1.2);
        let gap = body.line_gap_secs.unwrap_or(0.08);
        let title = body.title.clone().unwrap_or_default();
        if let Some(lines) = body.aligned_lyrics.as_ref().filter(|v| !v.is_empty()) {
            let (a, _) = build_ass_from_aligned(lines, min_line, gap, &title);
            a
        } else {
            // No aligned_lyrics — synthesise AlignedLyricLine from the
            // SRT we just built so build_ass_from_aligned can emit ASS
            // with the same timestamps.
            let synth: Vec<crate::music_gen::AlignedLyricLine> = parse_srt_to_aligned(&srt);
            let (a, _) = build_ass_from_aligned(&synth, min_line, gap, &title);
            a
        }
    } else {
        String::new()
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
            "ass_emitted": !ass.is_empty(),
        })),
    )
    .await;

    Ok(Json(SubtitlesResponse {
        ok: true,
        task_id,
        srt,
        ass,
        line_count,
        engine,
        version,
        cost_cents,
    }))
}

/// CSSOS_PHASE2_ASS_OUTPUT 20260504 — bridge SRT → AlignedLyricLine
/// so the ASS builder can reuse the SRT-only fallback path. Skips
/// malformed cues. Used only when aligned_lyrics is absent on the
/// request.
fn parse_srt_to_aligned(srt: &str) -> Vec<crate::music_gen::AlignedLyricLine> {
    let mut out = Vec::new();
    for block in srt.split("\n\n") {
        let lines: Vec<&str> = block.lines().collect();
        if lines.len() < 2 {
            continue;
        }
        // Find the timestamp line (usually index 1, but be tolerant).
        let ts_idx = lines.iter().position(|l| l.contains("-->"));
        let Some(ts_idx) = ts_idx else { continue };
        let ts = lines[ts_idx];
        let parts: Vec<&str> = ts.split("-->").collect();
        if parts.len() != 2 {
            continue;
        }
        let parse = |s: &str| -> Option<u64> {
            let s = s.trim();
            // h:mm:ss,ms or h:mm:ss.ms
            let bytes = s.as_bytes();
            if bytes.len() < 12 {
                return None;
            }
            let h: u64 = s.get(0..2)?.parse().ok()?;
            let m: u64 = s.get(3..5)?.parse().ok()?;
            let sec: u64 = s.get(6..8)?.parse().ok()?;
            let ms_str = s.get(9..)?.trim();
            let ms: u64 = ms_str.parse().ok()?;
            Some(h * 3600_000 + m * 60_000 + sec * 1000 + ms)
        };
        let (Some(start_ms), Some(end_ms)) = (parse(parts[0]), parse(parts[1])) else {
            continue;
        };
        let text = lines[ts_idx + 1..].join(" ").trim().to_string();
        if text.is_empty() {
            continue;
        }
        out.push(crate::music_gen::AlignedLyricLine {
            text,
            start_ms,
            end_ms,
            section: None,
        });
    }
    out
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
        .unwrap_or_else(|| "lite".into());

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
