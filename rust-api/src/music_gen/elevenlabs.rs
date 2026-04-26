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
const DEFAULT_MUSIC_LENGTH_MS: u64 = 30_000;
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

    async fn submit(&self, req: &MusicGenRequest) -> Result<SubmitAck, MusicGenError> {
        let url = format!(
            "{}{}",
            self.cfg.base_url.trim_end_matches('/'),
            self.cfg.submit_path
        );

        // The ElevenLabs Music API accepts `prompt`, `music_length_ms`, and
        // `model_id` at the top level. Optional style/lyrics get folded into
        // the prompt for v1 (there's no separate lyrics field yet); if ops
        // flip `ELEVEN_MUSIC_USE_LYRICS_FIELD=1` we emit a separate key.
        let composed_prompt = compose_prompt(req);
        let mut body = serde_json::Map::new();
        body.insert(
            "prompt".into(),
            serde_json::Value::String(composed_prompt.clone()),
        );
        body.insert(
            "music_length_ms".into(),
            serde_json::Value::Number(serde_json::Number::from(self.cfg.music_length_ms)),
        );
        // CSSOS_PHASE2_ELEVEN_MODEL_OPTIONAL 20260425 #100 — Jing saw
        // ElevenLabs reject `"model_id":"eleven_music_v1"` with 422
        // "Invalid model id". ElevenLabs has changed their Music model
        // IDs multiple times; rather than hardcode one that'll break
        // again, we only emit model_id when ops has explicitly set
        // ELEVEN_MUSIC_MODEL in env. Without the env, ElevenLabs uses
        // its own server-side default — which always works.
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
        if let Some(lyrics) = req
            .lyrics
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            if std::env::var("ELEVEN_MUSIC_USE_LYRICS_FIELD")
                .ok()
                .map(|s| {
                    let t = s.trim().to_ascii_lowercase();
                    t == "1" || t == "true" || t == "yes"
                })
                .unwrap_or(false)
            {
                body.insert(
                    "lyrics".into(),
                    serde_json::Value::String(lyrics.to_string()),
                );
            }
        }
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
