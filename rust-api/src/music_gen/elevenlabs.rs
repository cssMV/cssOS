// CSSOS_PHASE2_ELEVEN 20260419 — ElevenLabs Music HTTP adapter (MVP).
//
// ElevenLabs shipped a dedicated Music API in 2025 at
// `POST https://api.elevenlabs.io/v1/music` (key-based auth via the
// `xi-api-key` header — same key ops already use for TTS/voice). The
// public surface is synchronous: the response body is `audio/mpeg` bytes
// unless the caller opts into a JSON/stream variant.
//
// For us the "download bytes in-process" shape is awkward — our internal
// MusicGenResult assumes a URL we can hand back to the browser. We
// accommodate this by:
//   • default: submit synchronously, stash the bytes on local disk under
//     `ELEVEN_MUSIC_CACHE_DIR` (env, defaults to `/tmp/cssos-music`),
//     and return a `file://` URL. The caller (pipeline_mv_api) already
//     snapshots to `work_assets` so the file:// URL is fine for the
//     single-request lifetime.
//   • async path: if an ops-configured gateway exposes a polling API
//     (e.g. self-hosted wrapper), `ELEVEN_MUSIC_ASYNC=1` switches to
//     submit→poll like Suno, using `ELEVEN_MUSIC_SUBMIT_PATH` +
//     `ELEVEN_MUSIC_POLL_PATH`.
//
// All tunables (endpoint, auth header name, duration, model) are
// env-overridable so ops can flip to a newer endpoint without a redeploy.
// Degrades cleanly to `MusicGenError::NotConfigured` when ELEVEN_API_KEY
// is not set — the engine_registry gate mirrors this so the UI never
// surfaces ElevenLabs Music as selectable without a key present.

use std::path::PathBuf;
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue};
use serde::{Deserialize, Serialize};

use super::musicgpt::{MusicGenError, MusicGenRequest, MusicGenResult};

const DEFAULT_BASE_URL: &str = "https://api.elevenlabs.io";
const DEFAULT_SUBMIT_PATH: &str = "/v1/music";
const DEFAULT_POLL_PATH: &str = "/v1/music/generations";
const DEFAULT_AUTH_HEADER: &str = "xi-api-key";
const DEFAULT_MODEL: &str = "eleven_music_v1";
const DEFAULT_POLL_INTERVAL_SECS: u64 = 4;
const DEFAULT_TIMEOUT_SECS: u64 = 600;
const DEFAULT_HTTP_TIMEOUT_SECS: u64 = 90;
// CSSOS_PHASE2_MUSIC_DEFAULT_FULL 20260428 #168.1 — Jing
// "我们也不一定写死5分钟，而是歌词需要有多少分钟，就应该有多少分钟。
//  甚至不要局限于行业标准的8分钟，我曾在Suno用Extend一首歌到6:30分钟。"
//
// Old default was 30s (test-tier value) so when lyrics broadcast was
// broken and target_duration_secs didn't reach the adapter, we got
// 30-60s output. New default 180s (3 min) is the floor every real
// song should clear; lyrics-derived target_duration_secs override it.
const DEFAULT_MUSIC_LENGTH_MS: u64 = 180_000;
const DEFAULT_CACHE_DIR: &str = "/tmp/cssos-music";

#[derive(Debug, Clone)]
pub struct ElevenMusicConfig {
    pub api_key: String,
    pub base_url: String,
    pub submit_path: String,
    pub poll_path: String,
    pub auth_header: String,
    pub model: String,
    pub poll_interval: Duration,
    pub overall_timeout: Duration,
    pub http_timeout: Duration,
    pub music_length_ms: u64,
    pub async_mode: bool,
    pub cache_dir: PathBuf,
}

impl ElevenMusicConfig {
    /// Read config from environment. Returns None when ELEVEN_API_KEY is
    /// empty/unset so callers can decide whether to error or fall back.
    pub fn from_env() -> Option<Self> {
        // ELEVEN_API_KEY is the canonical name (matches what the TTS adapter
        // already uses); ELEVENLABS_API_KEY is accepted as an alias.
        let api_key = std::env::var("ELEVEN_API_KEY")
            .ok()
            .or_else(|| std::env::var("ELEVENLABS_API_KEY").ok())?;
        let api_key = api_key.trim().to_string();
        if api_key.is_empty() {
            return None;
        }
        Some(Self::with_api_key_and_env(api_key))
    }

    /// CSSOS_PHASE2_BYOK 20260420 — Task #71 ElevenLabs BYOK constructor.
    /// Uses the user-supplied API key, inherits every other knob (base URL,
    /// submit path, cache dir, timeouts, async mode) from env overrides so
    /// ops can still A/B a sandbox endpoint without touching the per-user
    /// rows. Empty key gets rejected at the upper layer
    /// (engine_credentials::api::upsert_key requires >= 8 chars).
    pub fn with_api_key(api_key: String) -> Self {
        Self::with_api_key_and_env(api_key)
    }

    fn with_api_key_and_env(api_key: String) -> Self {
        let base_url = env_or(
            &["ELEVEN_MUSIC_BASE_URL", "ELEVEN_BASE_URL"],
            DEFAULT_BASE_URL,
        );
        let submit_path = env_or(&["ELEVEN_MUSIC_SUBMIT_PATH"], DEFAULT_SUBMIT_PATH);
        let poll_path = env_or(&["ELEVEN_MUSIC_POLL_PATH"], DEFAULT_POLL_PATH);
        let auth_header = env_or(&["ELEVEN_AUTH_HEADER"], DEFAULT_AUTH_HEADER);
        let model = env_or(&["ELEVEN_MUSIC_MODEL"], DEFAULT_MODEL);
        let poll_interval = std::env::var("ELEVEN_MUSIC_POLL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_POLL_INTERVAL_SECS);
        let overall_timeout = std::env::var("ELEVEN_MUSIC_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_TIMEOUT_SECS);
        let http_timeout = std::env::var("ELEVEN_MUSIC_HTTP_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_HTTP_TIMEOUT_SECS);
        let music_length_ms = std::env::var("ELEVEN_MUSIC_LENGTH_MS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_MUSIC_LENGTH_MS);
        let async_mode = std::env::var("ELEVEN_MUSIC_ASYNC")
            .ok()
            .map(|s| {
                let t = s.trim().to_ascii_lowercase();
                t == "1" || t == "true" || t == "yes"
            })
            .unwrap_or(false);
        let cache_dir = std::env::var("ELEVEN_MUSIC_CACHE_DIR")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(DEFAULT_CACHE_DIR));
        Self {
            api_key,
            base_url,
            submit_path,
            poll_path,
            auth_header,
            model,
            poll_interval: Duration::from_secs(poll_interval),
            overall_timeout: Duration::from_secs(overall_timeout),
            http_timeout: Duration::from_secs(http_timeout),
            music_length_ms,
            async_mode,
            cache_dir,
        }
    }
}

/// CSSOS_PHASE2_BYOK 20260420 — Task #71 shape of `GET /v1/user`. ElevenLabs
/// returns a nested `subscription` dict with the per-account character
/// budget + tier; we flatten the useful fields here so the BYOK settings
/// card can render "ElevenLabs · 42,318 / 100,000 chars · creator" next to
/// the key row. Every field is optional because tier-specific response
/// shapes differ; `raw` preserves the full payload as a fallback.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ElevenUserInfo {
    #[serde(default, rename = "xi_api_key")]
    pub xi_api_key_suffix: Option<String>,
    #[serde(default)]
    pub first_name: Option<String>,
    #[serde(default)]
    pub tier: Option<String>,
    /// Remaining characters = limit - used. Exposed as the headline number.
    #[serde(default)]
    pub character_balance: Option<i64>,
    #[serde(default)]
    pub character_count: Option<i64>,
    #[serde(default)]
    pub character_limit: Option<i64>,
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub raw: serde_json::Value,
}

fn env_or(keys: &[&str], default_val: &str) -> String {
    for k in keys {
        if let Ok(v) = std::env::var(k) {
            let t = v.trim();
            if !t.is_empty() {
                return t.to_string();
            }
        }
    }
    default_val.to_string()
}

pub struct ElevenMusicClient {
    cfg: ElevenMusicConfig,
    http: reqwest::Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SubmitAck {
    task_id: String,
    audio_url: Option<String>,
    inline_bytes: Option<Vec<u8>>,
    inline_content_type: Option<String>,
}

impl ElevenMusicClient {
    pub fn new(cfg: ElevenMusicConfig) -> Result<Self, MusicGenError> {
        // CSSOS_PHASE2_ELEVEN_AUTH_FIX 20260425 #119 — Jing
        // ElevenLabs returns
        //   401 {"status":"api_key_with_authorization_header_not_allowed",
        //        "message":"Only one of xi-api-key and authorization
        //                   headers must be provided. Received both"}
        // when both headers are set on the same request. Our previous
        // "defensive Bearer" hack was the culprit — every music submit
        // was 401'ing immediately. We now send EXACTLY one auth header,
        // chosen by config (default xi-api-key). Self-hosted gateways
        // that expect Bearer can opt in via ELEVEN_MUSIC_AUTH_HEADER=
        // "Authorization" (with value formatted as "Bearer <key>").
        let mut headers = HeaderMap::new();
        let header_name_str = cfg.auth_header.trim();
        let is_authorization = header_name_str.eq_ignore_ascii_case("Authorization");
        let header_value = if is_authorization {
            format!("Bearer {}", cfg.api_key)
        } else {
            cfg.api_key.clone()
        };
        if let Ok(v) = HeaderValue::from_str(&header_value) {
            if let Ok(name) = reqwest::header::HeaderName::from_bytes(header_name_str.as_bytes()) {
                headers.insert(name, v);
            }
        }
        let http = reqwest::Client::builder()
            .timeout(cfg.http_timeout)
            .connect_timeout(std::time::Duration::from_secs(10))
            .tcp_keepalive(Some(std::time::Duration::from_secs(30)))
            .pool_max_idle_per_host(2)
            .default_headers(headers)
            .user_agent("cssos-rust-api/phase2-eleven-music")
            .build()?;
        Ok(Self { cfg, http })
    }

    pub fn from_env() -> Result<Self, MusicGenError> {
        match ElevenMusicConfig::from_env() {
            Some(cfg) => Self::new(cfg),
            None => Err(MusicGenError::NotConfigured {
                engine: "ElevenLabs Music",
                env_var: "ELEVEN_API_KEY",
            }),
        }
    }

    /// CSSOS_PHASE2_BYOK 20260420 — Task #71 whoami. Lightweight round-trip
    /// used to validate a user-supplied key when they save it. Hits
    /// `GET /v1/user`; returns the JSON decoded into `ElevenUserInfo` with
    /// the raw payload preserved for any fields ElevenLabs adds later.
    /// Character balance is computed from subscription.character_count vs
    /// character_limit. Any non-2xx maps to Upstream so the settings panel
    /// can render the upstream error verbatim.
    pub async fn whoami(&self) -> Result<ElevenUserInfo, MusicGenError> {
        let url = format!(
            "{}/v1/user",
            self.cfg.base_url.trim_end_matches('/')
        );
        let resp = self.http.get(&url).send().await?;
        let status = resp.status();
        let text = resp.text().await?;
        if !status.is_success() {
            return Err(MusicGenError::Upstream {
                status: status.as_u16(),
                body: text,
            });
        }
        let raw: serde_json::Value =
            serde_json::from_str(&text).map_err(|e| MusicGenError::Upstream {
                status: status.as_u16(),
                body: format!("non-json response: {} ({})", e, text),
            })?;

        // ElevenLabs nests subscription details under `subscription`; pull
        // the fields we care about up to the top. `character_limit -
        // character_count` is the remaining budget the user cares about.
        let sub = raw.get("subscription");
        let character_count = sub
            .and_then(|s| s.get("character_count"))
            .and_then(|x| x.as_i64());
        let character_limit = sub
            .and_then(|s| s.get("character_limit"))
            .and_then(|x| x.as_i64());
        let character_balance = match (character_count, character_limit) {
            (Some(used), Some(limit)) => Some((limit - used).max(0)),
            _ => None,
        };
        let tier = sub
            .and_then(|s| s.get("tier"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());
        let first_name = raw
            .get("first_name")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());
        let xi_api_key_suffix = raw
            .get("xi_api_key")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string());

        Ok(ElevenUserInfo {
            xi_api_key_suffix,
            first_name,
            tier,
            character_balance,
            character_count,
            character_limit,
            raw,
        })
    }

    pub async fn generate(
        &self,
        req: &MusicGenRequest,
    ) -> Result<MusicGenResult, MusicGenError> {
        // CSSOS_PHASE2_ELEVEN_SIDECAR 20260429 #185 — Jing
        // "请使用composition-plan模式 ... 走官方 SDK 才稳"
        // When ELEVEN_MUSIC_VIA_SIDECAR=1 is set, delegate to the local
        // Python sidecar that wraps the official elevenlabs SDK. This is
        // the path that produces real sung vocals — flat-prompt mode
        // (below) keeps existing as a graceful fallback if the sidecar
        // is offline or rejects the request.
        if std::env::var("ELEVEN_MUSIC_VIA_SIDECAR").ok().as_deref() == Some("1") {
            match self.generate_via_sidecar(req).await {
                Ok(result) => return Ok(result),
                Err(err) => {
                    tracing::warn!(
                        target = "elevenlabs_music",
                        sidecar_error = %err,
                        "sidecar compose failed; falling back to flat-prompt path"
                    );
                    // fall through to legacy submit() path
                }
            }
        }

        let ack = self.submit(req).await?;

        // Sync path: bytes already in hand, or URL already resolved inline.
        if let Some(url) = ack.audio_url.clone() {
            return Ok(finalize_result_from_url(&ack, url));
        }
        if let (Some(bytes), Some(_ct)) =
            (ack.inline_bytes.as_ref(), ack.inline_content_type.as_ref())
        {
            let url = self.cache_bytes_to_local_url(&ack.task_id, bytes)?;
            return Ok(finalize_result_from_url(&ack, url));
        }

        // Async path: poll for completion.
        if self.cfg.async_mode {
            return self.poll_until_done(&ack).await;
        }

        Err(MusicGenError::MissingField("audio_url|audio_bytes"))
    }

    /// CSSOS_PHASE2_ELEVEN_SIDECAR 20260429 #185 — Jing
    /// "请使用 composition-plan 模式 ... 走官方 SDK 才稳"
    ///
    /// POSTs to a localhost FastAPI sidecar (`/srv/cssos/eleven-music-sidecar`)
    /// that wraps the official `elevenlabs` Python SDK. The sidecar handles
    /// composition_plan schema-drift for us; we just hand it the lyrics +
    /// style + duration and stream the resulting mp3 bytes back.
    ///
    /// Returns a `MusicGenResult` with the cached `file://` URL exactly the
    /// way the legacy `submit()` path does, so callers see no shape change.
    /// Falls back to the caller (which then tries flat-prompt) on any error.
    async fn generate_via_sidecar(
        &self,
        req: &MusicGenRequest,
    ) -> Result<MusicGenResult, MusicGenError> {
        let sidecar_url = std::env::var("ELEVEN_MUSIC_SIDECAR_URL")
            .unwrap_or_else(|_| "http://127.0.0.1:8765".into());
        let endpoint = format!("{}/compose", sidecar_url.trim_end_matches('/'));

        // Resolve the same target duration the flat-prompt path uses, so a
        // run that asked for 5 min gets 5 min from either branch.
        let duration_ms: u64 = match req.target_duration_secs {
            Some(secs) if secs > 0 => (secs.clamp(30, 1200) as u64) * 1000,
            _ => self.cfg.music_length_ms,
        };

        // MusicGenRequest gives us `prompt` (visual/song seed), `music_style`
        // (genre + mood text), and `lyrics`. The sidecar treats `style` as
        // the global style description, so concat prompt + music_style as
        // one global hint and ship the full lyric body for sectioning.
        let style_text = match (req.prompt.as_str(), req.music_style.as_deref()) {
            ("", Some(ms)) if !ms.is_empty() => ms.to_string(),
            (p, Some(ms)) if !p.is_empty() && !ms.is_empty() => format!("{}. {}", p, ms),
            (p, _) => p.to_string(),
        };
        let body = serde_json::json!({
            "title":             req.prompt.clone(),
            "lyrics":            req.lyrics.clone().unwrap_or_default(),
            "style":             style_text,
            "duration_ms":       duration_ms,
            "language":          serde_json::Value::Null,
            "make_instrumental": req.make_instrumental,
            "output_format":     "mp3_44100_192",
        });

        // The sidecar needs as much wall-time as the SDK does; ElevenLabs
        // composition_plan can take 60-120 s for a 3-5 min song. We give
        // it 8 min before treating it as hung.
        let sidecar_http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(480))
            .connect_timeout(std::time::Duration::from_secs(5))
            .pool_max_idle_per_host(1)
            .user_agent("cssos-rust-api/eleven-sidecar")
            .build()?;

        tracing::info!(
            target = "elevenlabs_music",
            sidecar_url = %endpoint,
            duration_ms = duration_ms,
            instrumental = req.make_instrumental,
            "sidecar compose start"
        );

        let resp = sidecar_http
            .post(&endpoint)
            .json(&body)
            .send()
            .await?;
        let status = resp.status();
        if !status.is_success() {
            let detail = resp.text().await.unwrap_or_default();
            tracing::warn!(
                target = "elevenlabs_music",
                status = status.as_u16(),
                detail = %detail,
                "sidecar compose failed"
            );
            return Err(MusicGenError::Upstream {
                status: status.as_u16(),
                body: detail,
            });
        }
        // CSSOS_PHASE2_ALIGNED_LYRICS_FROM_PLAN 20260429 #190 — Jing
        // "字幕引擎没有拿到带时间戳的歌词时间轴".
        // The sidecar synthesizes per-line timestamps from the
        // composition_plan and ships them base64-encoded in this header
        // so the bytes body itself stays clean audio. Decode + parse here
        // so /api/mv/subtitles can build a real SRT instead of even-divide.
        let aligned_b64 = resp
            .headers()
            .get("X-Eleven-Aligned-Lyrics-B64")
            .and_then(|h| h.to_str().ok())
            .map(|s| s.to_string());

        let bytes = resp.bytes().await?;
        if bytes.is_empty() {
            return Err(MusicGenError::Upstream {
                status: status.as_u16(),
                body: "sidecar returned 0 audio bytes".into(),
            });
        }

        let aligned_lyrics: Option<Vec<crate::music_gen::AlignedLyricLine>> = aligned_b64
            .as_deref()
            .and_then(|b64| {
                use base64::Engine;
                base64::engine::general_purpose::STANDARD.decode(b64).ok()
            })
            .and_then(|raw| String::from_utf8(raw).ok())
            .and_then(|s| serde_json::from_str(&s).ok());

        // Cache the bytes under the same scheme the flat-prompt path uses
        // so downstream (compose pipeline, work_assets, polling) treats it
        // identically to a regular ElevenLabs synchronous response.
        let task_id = format!("eleven-sidecar-{}", chrono::Utc::now().timestamp_millis());
        let url = self.cache_bytes_to_local_url(&task_id, &bytes)?;

        tracing::info!(
            target = "elevenlabs_music",
            task_id = %task_id,
            bytes = bytes.len(),
            cached_url = %url,
            "sidecar compose ok"
        );

        Ok(MusicGenResult {
            task_id,
            conversion_id: None,
            audio_url: url,
            format: "mp3".into(),
            duration_secs: Some(duration_ms as f64 / 1000.0),
            title: if req.prompt.is_empty() { None } else { Some(req.prompt.clone()) },
            raw: serde_json::json!({
                "engine": "elevenlabs",
                "version": "v1-composition-plan",
                "via": "sidecar",
                "duration_ms": duration_ms,
                "bytes": bytes.len(),
            }),
            // Sidecar synthesizes aligned_lyrics from composition_plan
            // section durations (#190). When parsing failed for any
            // reason the value is None and downstream falls back to the
            // even-divide path in /api/mv/subtitles.
            aligned_lyrics,
            // ElevenLabs Music returns a single track per request; #208
            // dual-track is Suno-only.
            alt_audio_url: None,
            alt_duration_secs: None,
            alt_conversion_id: None,
        })
    }

    async fn submit(&self, req: &MusicGenRequest) -> Result<SubmitAck, MusicGenError> {
        let url = format!(
            "{}{}",
            self.cfg.base_url.trim_end_matches('/'),
            self.cfg.submit_path
        );

        // CSSOS_PHASE2_TARGET_DURATION 20260426 #148-C — Jing
        // "京典模板10节歌词，输出的音乐一般在5分钟左右，现在只有30秒。"
        // CSSOS_PHASE2_LONG_SONG 20260428 #168.1 — bumped ceiling 300→600.
        // CSSOS_PHASE2_COMPOSITION_PLAN 20260429 #168.10 — Jing
        // "我已经升级为ElevenCreative了... ElevenLabs Music API 在同一个
        //  endpoint 同时支持两种模式。那就请使用composition-plan模式。"
        // Resolve target length first so both code paths use it.
        let resolved_length_ms: u64 = match req.target_duration_secs {
            Some(secs) if secs > 0 => {
                // composition_plan mode supports longer pieces — relax
                // ceiling from 600 to 1200 (20 min). Sync mode still caps
                // at 600 below in practice (ElevenLabs returns ~60-90s
                // regardless of music_length_ms in that mode).
                let clamped = secs.clamp(30, 1200) as u64;
                let ms = clamped * 1000;
                tracing::info!(
                    target = "elevenlabs_music",
                    requested_secs = secs,
                    clamped_secs = clamped,
                    resolved_ms = ms,
                    "honoring caller-supplied target_duration_secs"
                );
                ms
            }
            _ => {
                tracing::warn!(
                    target = "elevenlabs_music",
                    default_ms = self.cfg.music_length_ms,
                    "caller passed NO target_duration_secs — using default; \
                     lyrics broadcast may be broken upstream"
                );
                self.cfg.music_length_ms
            }
        };

        let composed_prompt = compose_prompt(req);
        let lyrics_clean = req
            .lyrics
            .as_ref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());

        // CSSOS_PHASE2_DROP_COMPOSITION_PLAN 20260429 #174 — Jing
        // "只是朗读歌词，而不是唱旋律歌词" — composition_plan body in our
        // schema turned out to make ElevenLabs treat sections as TTS-style
        // narration instead of sung music. Schema mismatch with their
        // internal field names. Until we can validate the real schema,
        // GATE composition_plan behind ELEVEN_MUSIC_COMPOSITION_PLAN=1 env
        // and default to the documented prompt+lyrics+music_length_ms form
        // that genuinely outputs sung vocals at the requested duration
        // (Creator plan supports up to 10 min when lyrics is non-empty).
        let style_hint = req
            .music_style
            .as_ref()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        let composition_plan_enabled = std::env::var("ELEVEN_MUSIC_COMPOSITION_PLAN")
            .ok()
            .map(|s| {
                let t = s.trim().to_ascii_lowercase();
                t == "1" || t == "true" || t == "yes"
            })
            .unwrap_or(false);
        let plan_opt = if composition_plan_enabled {
            if let Some(ref lyrics) = lyrics_clean {
                build_composition_plan(
                    lyrics,
                    resolved_length_ms,
                    style_hint.as_deref(),
                    req.make_instrumental,
                )
            } else {
                None
            }
        } else {
            None
        };

        let mut body = serde_json::Map::new();
        let using_composition_plan = plan_opt.is_some();
        if let Some(plan) = plan_opt {
            // CSSOS_PHASE2_PLAN_EXCLUSIVE 20260429 #171b — Jing
            // ElevenLabs rejects sending BOTH `prompt` and `composition_plan`:
            //   422 "You must provide exactly one of `prompt` or
            //        `composition_plan`."
            // Send ONLY composition_plan in this mode (sections carry their
            // own duration + lines + style hints). Top-level prompt /
            // lyrics / music_length_ms get DROPPED here.
            tracing::info!(
                target = "elevenlabs_music",
                resolved_ms = resolved_length_ms,
                "using composition_plan mode for long-form generation (exclusive — no prompt/lyrics/music_length_ms top-level)"
            );
            body.insert("composition_plan".into(), plan);
        } else {
            // CSSOS_PHASE2_LYRICS_INLINE_PROMPT 20260429 #178 — Jing
            // "音乐里的人声呢？之前是有人声的哦"
            // Top-level `lyrics` field made Eleven generate INSTRUMENTAL.
            // Their /v1/music flat body apparently treats `prompt` as the
            // ONLY content directive — `lyrics` is silently ignored. Solution:
            // embed the lyrics directly INSIDE the prompt with explicit
            // "sung vocals" instruction so the engine knows it's singing.
            //
            // Body shape:
            //   { prompt: "<style>. Sing these lyrics:\n<full lyrics>",
            //     music_length_ms }
            let mut prompt_text = composed_prompt.clone();
            // Add explicit vocal-mode instruction unless instrumental.
            if !req.make_instrumental && lyrics_clean.is_some() {
                let raw = lyrics_clean.as_deref().unwrap_or("");
                let cleaned = clean_lyrics_for_singing(raw);
                if !cleaned.is_empty() {
                    if !prompt_text.is_empty() {
                        prompt_text.push_str(". ");
                    }
                    prompt_text.push_str(
                        "Full vocal performance with sung lyrics. \
                        The vocalist must clearly sing every line below \
                        from start to finish across the whole duration. \
                        Sing these exact lyrics in order:\n\n",
                    );
                    prompt_text.push_str(&cleaned);
                }
            }
            tracing::info!(
                target = "elevenlabs_music",
                resolved_ms = resolved_length_ms,
                has_lyrics = lyrics_clean.is_some(),
                prompt_chars = prompt_text.chars().count(),
                "using flat prompt+music_length_ms mode (lyrics inlined into prompt)"
            );
            body.insert(
                "prompt".into(),
                serde_json::Value::String(prompt_text),
            );
            body.insert(
                "music_length_ms".into(),
                serde_json::Value::Number(serde_json::Number::from(resolved_length_ms)),
            );
        }
        // CSSOS_PHASE2_ELEVEN_MODEL_OPTIONAL 20260425 #100 — Jing saw
        // ElevenLabs reject `"model_id":"eleven_music_v1"` with 422
        // "Invalid model id". Only emit model_id when ops explicitly
        // configured ELEVEN_MUSIC_MODEL; otherwise let server pick.
        // Applies to both modes.
        let explicit_model = std::env::var("ELEVEN_MUSIC_MODEL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty());
        if let Some(model) = explicit_model {
            body.insert(
                "model_id".into(),
                serde_json::Value::String(model),
            );
        }
        let _ = using_composition_plan; // reserved for future logging
        let body = serde_json::Value::Object(body);
        let resp = self.http.post(&url).json(&body).send().await?;
        let status = resp.status();
        let content_type = resp
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
            .unwrap_or("")
            .to_string();

        if !status.is_success() {
            let text = resp.text().await.unwrap_or_default();
            return Err(MusicGenError::Upstream {
                status: status.as_u16(),
                body: text,
            });
        }

        // Response flavors:
        //  • application/json → { generation_id | id | task_id, audio_url? }
        //  • audio/mpeg or audio/* → raw MP3 bytes (sync flow)
        if content_type.starts_with("application/json") {
            let text = resp.text().await?;
            let v: serde_json::Value =
                serde_json::from_str(&text).map_err(|e| MusicGenError::Upstream {
                    status: status.as_u16(),
                    body: format!("non-json despite content-type: {} ({})", e, text),
                })?;
            let task_id = v
                .get("generation_id")
                .or_else(|| v.get("id"))
                .or_else(|| v.get("task_id"))
                .and_then(|x| x.as_str())
                .unwrap_or("eleven-sync")
                .to_string();
            let audio_url = v
                .get("audio_url")
                .or_else(|| v.get("url"))
                .and_then(|x| x.as_str())
                .map(|s| s.to_string());
            return Ok(SubmitAck {
                task_id,
                audio_url,
                inline_bytes: None,
                inline_content_type: None,
            });
        }

        // Binary audio path.
        let bytes = resp.bytes().await?.to_vec();
        let task_id = format!("eleven-sync-{}", short_hash(&bytes));
        Ok(SubmitAck {
            task_id,
            audio_url: None,
            inline_bytes: Some(bytes),
            inline_content_type: Some(content_type),
        })
    }

    fn cache_bytes_to_local_url(
        &self,
        task_id: &str,
        bytes: &[u8],
    ) -> Result<String, MusicGenError> {
        std::fs::create_dir_all(&self.cfg.cache_dir).map_err(|e| MusicGenError::Upstream {
            status: 0,
            body: format!("cache_dir create failed: {}", e),
        })?;
        let filename = format!("{}.mp3", task_id);
        let path = self.cfg.cache_dir.join(&filename);
        std::fs::write(&path, bytes).map_err(|e| MusicGenError::Upstream {
            status: 0,
            body: format!("cache write failed: {}", e),
        })?;
        // Local file URL; the caller snapshots to work_assets before serving.
        Ok(format!("file://{}", path.display()))
    }

    async fn poll_until_done(
        &self,
        ack: &SubmitAck,
    ) -> Result<MusicGenResult, MusicGenError> {
        let started = std::time::Instant::now();
        let url = format!(
            "{}{}/{}",
            self.cfg.base_url.trim_end_matches('/'),
            self.cfg.poll_path.trim_end_matches('/'),
            ack.task_id
        );
        loop {
            if started.elapsed() > self.cfg.overall_timeout {
                return Err(MusicGenError::Timeout(self.cfg.overall_timeout));
            }
            let resp = self.http.get(&url).send().await?;
            let status = resp.status();
            let text = resp.text().await?;
            if !status.is_success() {
                if status.is_client_error() {
                    return Err(MusicGenError::Upstream {
                        status: status.as_u16(),
                        body: text,
                    });
                }
                tokio::time::sleep(self.cfg.poll_interval).await;
                continue;
            }
            let v: serde_json::Value = match serde_json::from_str(&text) {
                Ok(x) => x,
                Err(_) => {
                    tokio::time::sleep(self.cfg.poll_interval).await;
                    continue;
                }
            };
            let state = v
                .get("status")
                .or_else(|| v.get("state"))
                .and_then(|x| x.as_str())
                .unwrap_or("pending")
                .to_ascii_lowercase();
            match state.as_str() {
                "completed" | "success" | "succeeded" | "done" | "ready" => {
                    let audio_url = v
                        .get("audio_url")
                        .or_else(|| v.get("url"))
                        .and_then(|x| x.as_str())
                        .unwrap_or_default()
                        .to_string();
                    let duration_secs = v
                        .get("duration_secs")
                        .or_else(|| v.get("duration"))
                        .and_then(|x| x.as_f64());
                    // CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
                    // ElevenLabs Music returns `lyrics_with_timing` (per-line
                    // start/end seconds) in the completed-job payload. Pass
                    // through to /api/mv/subtitles so SRT timing matches the
                    // actual vocal performance instead of even-divided.
                    let aligned_lyrics = crate::music_gen::extract_aligned_lyrics(&v);
                    return Ok(MusicGenResult {
                        task_id: ack.task_id.clone(),
                        conversion_id: None,
                        audio_url,
                        format: "mp3".to_string(),
                        duration_secs,
                        title: None,
                        raw: v,
                        aligned_lyrics,
                        alt_audio_url: None,
                        alt_duration_secs: None,
                        alt_conversion_id: None,
                    });
                }
                "failed" | "error" | "canceled" | "cancelled" => {
                    return Err(MusicGenError::JobFailed(
                        v.get("error")
                            .and_then(|x| x.as_str())
                            .unwrap_or("eleven music job failed")
                            .to_string(),
                    ));
                }
                _ => {
                    tokio::time::sleep(self.cfg.poll_interval).await;
                }
            }
        }
    }
}

fn compose_prompt(req: &MusicGenRequest) -> String {
    // ElevenLabs Music v1 is prompt-only; style + instrumental flag are
    // surfaced via natural-language hints appended to the user prompt.
    // Keeping the composition logic in-adapter avoids touching the shared
    // MusicGenRequest shape — other adapters still see the structured fields.
    let mut parts: Vec<String> = Vec::new();
    parts.push(req.prompt.trim().to_string());
    if let Some(style) = req
        .music_style
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        parts.push(format!("style: {}", style));
    }
    if req.make_instrumental {
        parts.push("instrumental only, no vocals".to_string());
    }
    parts.retain(|s| !s.is_empty());
    parts.join(". ")
}

// CSSOS_PHASE2_COMPOSITION_PLAN 20260429 #168.10 — composition_plan helpers.
// ElevenLabs Music API accepts a sectioned plan body where each section has
// its own duration_ms + lines + local style hints; sum of section durations
// is the final song length. This is the path that supports 3-10 min songs.

/// Count `[Section Name]` markers in lyrics (one per line, header-only).
fn count_section_markers(lyrics: &str) -> usize {
    lyrics
        .lines()
        .map(|l| l.trim())
        .filter(|l| {
            l.starts_with('[')
                && l.ends_with(']')
                && l.len() >= 3
                && l.len() <= 40
                && !l.contains('\t')
        })
        .count()
}

/// Build a composition_plan JSON value from lyrics text + a target duration.
/// Returns None when lyrics is empty or unparseable.
fn build_composition_plan(
    lyrics: &str,
    total_duration_ms: u64,
    style_hint: Option<&str>,
    instrumental: bool,
) -> Option<serde_json::Value> {
    let trimmed = lyrics.trim();
    if trimmed.is_empty() {
        return None;
    }

    let sections = parse_lyric_sections(trimmed);
    if sections.is_empty() {
        return None;
    }

    let total_lines: usize = sections
        .iter()
        .map(|(_, lines)| lines.len().max(1))
        .sum::<usize>()
        .max(1);
    let total_ms = total_duration_ms.max(60_000);

    let mut json_sections: Vec<serde_json::Value> = Vec::new();
    let mut allocated_ms: u64 = 0;
    let last_idx = sections.len() - 1;
    for (i, (name, lines)) in sections.iter().enumerate() {
        let weight = lines.len().max(1) as f64 / total_lines as f64;
        let mut section_ms = (total_ms as f64 * weight) as u64;
        // Min 8s per section so very short sections still render.
        section_ms = section_ms.max(8_000);
        if i == last_idx {
            // Last section absorbs remainder so the sum hits total_ms exactly
            section_ms = total_ms.saturating_sub(allocated_ms).max(8_000);
        }
        allocated_ms = allocated_ms.saturating_add(section_ms);

        let mut section = serde_json::Map::new();
        section.insert(
            "section_name".into(),
            serde_json::Value::String(name.clone()),
        );
        section.insert(
            "duration_ms".into(),
            serde_json::Value::Number(serde_json::Number::from(section_ms)),
        );
        section.insert(
            "lines".into(),
            serde_json::Value::Array(
                lines
                    .iter()
                    .map(|l| serde_json::Value::String(l.clone()))
                    .collect(),
            ),
        );
        section.insert(
            "positive_local_styles".into(),
            serde_json::Value::Array(infer_local_styles(name, instrumental)),
        );
        section.insert(
            "negative_local_styles".into(),
            serde_json::Value::Array(vec![]),
        );
        json_sections.push(serde_json::Value::Object(section));
    }

    let mut positive_global: Vec<serde_json::Value> = Vec::new();
    if let Some(hint) = style_hint
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        positive_global.push(serde_json::Value::String(hint.to_string()));
    }
    if instrumental {
        positive_global.push(serde_json::Value::String(
            "instrumental, no vocals".to_string(),
        ));
    }
    if positive_global.is_empty() {
        positive_global.push(serde_json::Value::String(
            "cinematic emotional full vocal performance".to_string(),
        ));
    }

    let mut plan = serde_json::Map::new();
    plan.insert(
        "positive_global_styles".into(),
        serde_json::Value::Array(positive_global),
    );
    plan.insert(
        "negative_global_styles".into(),
        serde_json::Value::Array(vec![
            serde_json::Value::String("low quality, muddy, distorted".to_string()),
        ]),
    );
    plan.insert(
        "sections".into(),
        serde_json::Value::Array(json_sections),
    );
    Some(serde_json::Value::Object(plan))
}

/// CSSOS_PHASE2_CLEAN_LYRICS 20260429 #170 — Jing
/// "现在是不唱歌词，却朗读这些[]里的非歌词文案"
/// Strip every line wrapped in `[...]` (titles / acts / scenes / stage
/// directions / section headers) so what remains is ONLY the actual
/// sung lyric body. Used both inside composition_plan section.lines AND
/// as a top-level `lyrics` field, so ElevenLabs receives the cleanest
/// possible singing material no matter which field it reads.
fn clean_lyrics_for_singing(raw: &str) -> String {
    let mut out: Vec<String> = Vec::new();
    for line in raw.lines() {
        let t = line.trim();
        if t.is_empty() {
            continue;
        }
        if t.starts_with('[') && t.ends_with(']') {
            // Bracket-wrapped — drop entirely (header or metadata).
            continue;
        }
        // Strip leading/trailing bracket fragments inside an otherwise-
        // clean line, e.g. "[Verse 1] 无上" → "无上".
        let cleaned = if let (Some(l), Some(r)) = (t.find('['), t.rfind(']')) {
            if l == 0 && r > l {
                t[r + 1..].trim().to_string()
            } else if r == t.len() - 1 && l < r {
                t[..l].trim().to_string()
            } else {
                t.to_string()
            }
        } else {
            t.to_string()
        };
        if !cleaned.is_empty() {
            out.push(cleaned);
        }
    }
    out.join("\n")
}

/// Detect whether a `[Foo]` bracket line is a real section header
/// (Verse/Chorus/Bridge/etc.) versus narrative metadata
/// (`[Act I – ...]`, `[Scene I – ...]`, `[中国创世神话 盘古开天辟地]`).
/// Without this filter, ElevenLabs would happily *recite* the bracketed
/// metadata as if it were sung lyrics — exactly the failure Jing reported.
fn is_section_header_keyword(inner: &str) -> bool {
    let lc = inner.to_ascii_lowercase();
    let head = lc.split(|c: char| !c.is_ascii_alphanumeric() && c != '-')
        .find(|s| !s.is_empty())
        .unwrap_or("");
    matches!(
        head,
        "verse" | "chorus" | "bridge" | "intro" | "outro" | "hook" |
        "refrain" | "pre" | "prechorus" | "pre-chorus" | "coda" |
        "prelude" | "interlude" | "ending" | "opening" | "drop" | "build"
    )
}

/// Strip ALL `[ ... ]` bracketed wrappers from a lyric line so ElevenLabs
/// never receives "[Verse 1 – Deep Xun drone begins]" as text-to-sing.
fn looks_like_bracket_only_line(line: &str) -> bool {
    let t = line.trim();
    t.starts_with('[') && t.ends_with(']') && t.len() >= 3
}

/// Normalize a section header to a short, music-engine-friendly label
/// like "Verse 1", "Chorus", etc. — strips the freeform " – descriptor"
/// tail so ElevenLabs uses the keyword as a structure hint, not as text.
fn normalize_section_label(inner: &str) -> String {
    // Cut at first " – " / " - " / ":" / "(" — those start descriptions.
    let cut_at = inner
        .find(" – ")
        .or_else(|| inner.find(" - "))
        .or_else(|| inner.find('('))
        .or_else(|| inner.find('—'))
        .unwrap_or(inner.len());
    inner[..cut_at].trim().to_string()
}

/// Parse `[Section Header]` blocks. If no headers found, fall back to
/// heuristic split into Intro / Verse / Chorus / Outro by line groups.
///
/// CSSOS_PHASE2_STRIP_BRACKET_LYRICS 20260429 #170 — Jing
/// "现在是不唱歌词，却朗读这些[]里的非歌词文案，也不唱歌词，只朗读"
/// ElevenLabs was reading bracketed narrative wrappers as if they were
/// sung text. Now: only Verse/Chorus/Bridge/etc. brackets are treated as
/// section headers; ALL other bracketed lines (titles, acts, scenes,
/// stage directions) are DROPPED so they're never sung.
fn parse_lyric_sections(text: &str) -> Vec<(String, Vec<String>)> {
    let mut out: Vec<(String, Vec<String>)> = Vec::new();
    let mut current_name: Option<String> = None;
    let mut current_lines: Vec<String> = Vec::new();
    let mut found_marker = false;

    for raw in text.lines() {
        let line = raw.trim();
        if line.is_empty() {
            continue;
        }
        // Bracket-wrapped line: either a real section header or metadata.
        if line.starts_with('[') && line.ends_with(']') && line.len() >= 3 {
            let inner = line[1..line.len() - 1].trim();
            if is_section_header_keyword(inner) {
                // Real header (Verse 1 / Chorus / Bridge / Intro / Outro).
                found_marker = true;
                if !current_lines.is_empty() {
                    let name = current_name
                        .clone()
                        .unwrap_or_else(|| "Verse".to_string());
                    out.push((name, std::mem::take(&mut current_lines)));
                }
                current_name = Some(normalize_section_label(inner));
            } else {
                // Narrative metadata — DROP it. Never sing this.
                tracing::debug!(
                    target = "elevenlabs_music",
                    metadata = %inner,
                    "dropping bracket metadata line (not a section header)"
                );
            }
            continue;
        }
        // Non-bracket plain lyric line — but defensively drop any bracket-
        // wrapped fragments that slipped through the trim.
        if looks_like_bracket_only_line(line) {
            continue;
        }
        current_lines.push(line.to_string());
    }
    if !current_lines.is_empty() {
        let name = current_name
            .clone()
            .unwrap_or_else(|| "Verse".to_string());
        out.push((name, current_lines));
    }

    if !found_marker {
        // No real section markers — flatten and split heuristically.
        let all_lines: Vec<String> = out
            .into_iter()
            .flat_map(|(_, lines)| lines)
            .collect();
        return split_unmarked_into_sections(all_lines);
    }

    // Drop empty sections (header followed by no lines) defensively.
    out.into_iter().filter(|(_, l)| !l.is_empty()).collect()
}

/// Heuristic 4-section split for lyrics with no `[Section]` markers.
fn split_unmarked_into_sections(lines: Vec<String>) -> Vec<(String, Vec<String>)> {
    let n = lines.len();
    if n == 0 {
        return Vec::new();
    }
    if n < 4 {
        return vec![("Verse".to_string(), lines)];
    }
    if n < 8 {
        // Two-section split.
        let mid = n / 2;
        return vec![
            ("Verse".to_string(), lines[..mid].to_vec()),
            ("Chorus".to_string(), lines[mid..].to_vec()),
        ];
    }
    // Four-section split (Intro / Verse / Chorus / Outro).
    let chunk = (n + 3) / 4;
    let names = ["Intro", "Verse", "Chorus", "Outro"];
    let mut out: Vec<(String, Vec<String>)> = Vec::new();
    for (i, name) in names.iter().enumerate() {
        let start = i * chunk;
        if start >= n {
            break;
        }
        let end = ((i + 1) * chunk).min(n);
        out.push((name.to_string(), lines[start..end].to_vec()));
    }
    out
}

/// Per-section style hint based on section name pattern.
fn infer_local_styles(section_name: &str, instrumental: bool) -> Vec<serde_json::Value> {
    let n = section_name.to_ascii_lowercase();
    let hint = if n.contains("intro") || n.contains("opening") {
        "instrumental opening, building atmosphere, ambient swell"
    } else if n.contains("chorus") || n.contains("hook") || n.contains("refrain") {
        "powerful chorus, anthemic vocals, full instrumentation"
    } else if n.contains("bridge") {
        "emotional bridge, dynamic shift, rising tension"
    } else if n.contains("outro") || n.contains("ending") || n.contains("coda") {
        "concluding section, resolving fade, final cadence"
    } else if n.contains("verse") {
        "verse vocals, melodic flow, supporting instrumentation"
    } else if n.contains("pre") {
        "pre-chorus lift, building energy"
    } else {
        "melodic vocals, expressive delivery"
    };
    let mut out = vec![serde_json::Value::String(hint.to_string())];
    if instrumental {
        out.push(serde_json::Value::String(
            "instrumental only".to_string(),
        ));
    }
    out
}

fn finalize_result_from_url(ack: &SubmitAck, audio_url: String) -> MusicGenResult {
    // CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
    // The fast-sync path (binary audio response, no JSON envelope) has no
    // alignment data on the wire; pass `aligned_lyrics: None` so subtitles
    // fall back to even-divide for this code path. Async/poll path (above)
    // gets real timing.
    MusicGenResult {
        task_id: ack.task_id.clone(),
        conversion_id: None,
        audio_url,
        format: "mp3".to_string(),
        duration_secs: None,
        title: None,
        raw: serde_json::Value::Null,
        aligned_lyrics: None,
        alt_audio_url: None,
        alt_duration_secs: None,
        alt_conversion_id: None,
    }
}

fn short_hash(bytes: &[u8]) -> String {
    // Tiny DJB2 — good enough for a disambiguating task id suffix.
    let mut h: u64 = 5381;
    for &b in bytes.iter().take(4096) {
        h = h.wrapping_mul(33) ^ b as u64;
    }
    format!("{:x}", h)
}
