// CSSOS_PHASE2_SUNO 20260419 — Suno v5 HTTP adapter (single-shot MVP).
//
// Per Jing 20260419 we target the `sunoapi.org` gateway (docs at
// https://sunoapi.org, API base `https://api.sunoapi.org`). It's the most
// reliable publicly documented way to hit Suno v5 from a server — the raw
// `studio-api.suno.ai` / `api.suno.ai` endpoints are cookie-gated and not
// stable for headless use. The sunoapi.org shape is the documented one:
// submit → `GET /api/v1/generate/record-info?taskId=` → poll until status
// leaves the pending set → read `data.response.sunoData[0]`.
//
// All tunables (base URL, submit path, poll path, poll interval, model name,
// custom/instrumental modes) are env-overridable so ops can point at an
// alternative gateway (e.g. `studio-api.suno.ai`, a self-hosted wrapper, or a
// region-specific mirror) without a redeploy. Response parsing is defensive
// across several field-name variants so a minor upstream schema tweak doesn't
// break us.
//
// Flow:
//   1. POST {base}{submit_path} with { prompt, model, customMode, instrumental,
//      style, title, lyrics } (only non-empty keys). Bearer auth.
//      Response carries a task id (various names: `taskId`, `task_id`,
//      `data.taskId`, `id`) and sometimes pre-seeded clip ids in an array.
//   2. Poll {base}{poll_path}?taskId=<id> on a fixed cadence.
//      Response `data.status` ∈ {"PENDING","TEXT_SUCCESS","FIRST_SUCCESS",
//      "SUCCESS","SENSITIVE_WORD_ERROR","CREATE_TASK_FAILED","GENERATE_AUDIO_FAILED",
//      "CALLBACK_EXCEPTION",...}. We finish on SUCCESS (or FIRST_SUCCESS when
//      the caller opts into first-clip-early via env).
//   3. Extract `data.response.sunoData[0]` and return the mp3 URL + duration.
//
// The adapter does NOT download the audio — it's the caller's job to snapshot
// the URL into our work_assets storage so the stream keeps working after
// Suno rotates URLs.
//
// All tunables (base URL, submit path, poll path, poll interval, timeout,
// model name, Bearer header name, instrumental/custom mode) come from env so
// ops can tune without a redeploy; defaults reflect the publicly documented
// 2025 official-API shape.

use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::{Deserialize, Serialize};

use super::musicgpt::{MusicGenError, MusicGenRequest, MusicGenResult};

// Defaults target the sunoapi.org gateway (docs: https://sunoapi.org).
// `V5` is the default per Jing 20260419 (newest public Suno model with the
// best quality/latency tradeoff). `V4_5` / `V4` / `V3_5` remain valid and can
// be set via SUNO_MODEL without a redeploy.
const DEFAULT_BASE_URL: &str = "https://api.sunoapi.org";
const DEFAULT_SUBMIT_PATH: &str = "/api/v1/generate";
const DEFAULT_POLL_PATH: &str = "/api/v1/generate/record-info";
const DEFAULT_MODEL: &str = "V5";
const DEFAULT_POLL_INTERVAL_SECS: u64 = 6;
const DEFAULT_TIMEOUT_SECS: u64 = 600;
const DEFAULT_HTTP_TIMEOUT_SECS: u64 = 60;

#[derive(Debug, Clone)]
pub struct SunoConfig {
    pub api_key: String,
    pub base_url: String,
    pub submit_path: String,
    pub poll_path: String,
    pub model: String,
    pub poll_interval: Duration,
    pub overall_timeout: Duration,
    pub http_timeout: Duration,
    /// When true, returns as soon as the first clip is streamable
    /// (status == "FIRST_SUCCESS"). When false, wait for full "SUCCESS".
    pub return_on_first_clip: bool,
    /// Suno's `customMode` — when true the caller supplies style+title+lyrics
    /// explicitly; when false, Suno derives them from `prompt`. We auto-pick:
    /// if the caller provided lyrics OR a music_style, we enable custom mode;
    /// otherwise we default to the simpler "describe" flow.
    pub force_custom_mode: Option<bool>,
}

impl SunoConfig {
    /// Read config from environment. Returns None when SUNO_API_KEY is
    /// empty/unset so callers can decide whether to error or fall back.
    pub fn from_env() -> Option<Self> {
        let api_key = std::env::var("SUNO_API_KEY").ok()?;
        let api_key = api_key.trim().to_string();
        if api_key.is_empty() {
            return None;
        }
        let base_url = std::env::var("SUNO_BASE_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
        let submit_path = std::env::var("SUNO_SUBMIT_PATH")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_SUBMIT_PATH.to_string());
        let poll_path = std::env::var("SUNO_POLL_PATH")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_POLL_PATH.to_string());
        let model = std::env::var("SUNO_MODEL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_MODEL.to_string());
        let poll_interval = std::env::var("SUNO_POLL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_POLL_INTERVAL_SECS);
        let overall_timeout = std::env::var("SUNO_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_TIMEOUT_SECS);
        let http_timeout = std::env::var("SUNO_HTTP_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_HTTP_TIMEOUT_SECS);
        let return_on_first_clip = std::env::var("SUNO_RETURN_FIRST_CLIP")
            .ok()
            .map(|s| {
                let t = s.trim().to_ascii_lowercase();
                t == "1" || t == "true" || t == "yes"
            })
            .unwrap_or(false);
        let force_custom_mode = std::env::var("SUNO_FORCE_CUSTOM_MODE")
            .ok()
            .map(|s| s.trim().to_ascii_lowercase())
            .and_then(|s| match s.as_str() {
                "1" | "true" | "yes" => Some(true),
                "0" | "false" | "no" => Some(false),
                _ => None,
            });
        Some(Self {
            api_key,
            base_url,
            submit_path,
            poll_path,
            model,
            poll_interval: Duration::from_secs(poll_interval),
            overall_timeout: Duration::from_secs(overall_timeout),
            http_timeout: Duration::from_secs(http_timeout),
            return_on_first_clip,
            force_custom_mode,
        })
    }
}

pub struct SunoClient {
    cfg: SunoConfig,
    http: reqwest::Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SunoSubmitAck {
    task_id: String,
}

impl SunoClient {
    pub fn new(cfg: SunoConfig) -> Result<Self, MusicGenError> {
        // CSSOS_PHASE2_SUNO_AUTH_FIX 20260425 #119 — Jing
        // Same shared bug as the ElevenLabs adapter: sending BOTH
        // `Authorization: Bearer` AND `x-api-key` made strict gateways
        // (proxy/CDN/CF Worker) reject with 401 "duplicate auth
        // headers". Send EXACTLY one. Default is Bearer (Suno official
        // API); ops can opt into `x-api-key` for self-hosted wrappers
        // via SUNO_AUTH_HEADER=x-api-key.
        let mut headers = HeaderMap::new();
        let auth_header = std::env::var("SUNO_AUTH_HEADER")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| "Authorization".to_string());
        let is_bearer = auth_header.eq_ignore_ascii_case("Authorization");
        let value = if is_bearer {
            format!("Bearer {}", cfg.api_key)
        } else {
            cfg.api_key.clone()
        };
        if let Ok(v) = HeaderValue::from_str(&value) {
            if is_bearer {
                headers.insert(AUTHORIZATION, v);
            } else if let Ok(name) =
                reqwest::header::HeaderName::from_bytes(auth_header.as_bytes())
            {
                headers.insert(name, v);
            }
        }
        let http = reqwest::Client::builder()
            .timeout(cfg.http_timeout)
            .connect_timeout(std::time::Duration::from_secs(10))
            .tcp_keepalive(Some(std::time::Duration::from_secs(30)))
            .pool_max_idle_per_host(2)
            .default_headers(headers)
            .user_agent("cssos-rust-api/phase2-suno")
            .build()?;
        Ok(Self { cfg, http })
    }

    pub fn from_env() -> Result<Self, MusicGenError> {
        match SunoConfig::from_env() {
            Some(cfg) => Self::new(cfg),
            None => Err(MusicGenError::NotConfigured {
                engine: "Suno",
                env_var: "SUNO_API_KEY",
            }),
        }
    }

    /// Submit a generation request and block-poll until it completes or the
    /// configured `overall_timeout` is exceeded.
    pub async fn generate(
        &self,
        req: &MusicGenRequest,
    ) -> Result<MusicGenResult, MusicGenError> {
        let task = self.submit(req).await?;
        self.poll_until_done(&task).await
    }

    async fn submit(&self, req: &MusicGenRequest) -> Result<SunoSubmitAck, MusicGenError> {
        let url = format!(
            "{}{}",
            self.cfg.base_url.trim_end_matches('/'),
            self.cfg.submit_path
        );

        // Decide customMode: explicit env override wins; otherwise auto-pick
        // based on whether the caller is asking for a specific style/lyrics.
        let has_style = req
            .music_style
            .as_deref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        let has_lyrics = req
            .lyrics
            .as_deref()
            .map(|s| !s.trim().is_empty())
            .unwrap_or(false);
        let custom_mode = self
            .cfg
            .force_custom_mode
            .unwrap_or(has_style || has_lyrics);

        // CSSOS_PHASE2_MUSIC_VERSIONING 20260419 — per-request version wins
        // over env SUNO_MODEL. Maps user-facing "v3.5" / "v4" / "v4.5" / "v5"
        // → Suno's canonical model names "V3_5" / "V4" / "V4_5" / "V5".
        // Unknown/blank falls back to the env default so ops can still pin
        // a model globally via SUNO_MODEL.
        let effective_model = req
            .version
            .as_deref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
            .map(normalize_suno_model)
            .unwrap_or_else(|| self.cfg.model.clone());

        let mut body = serde_json::Map::new();
        body.insert(
            "prompt".into(),
            serde_json::Value::String(req.prompt.clone()),
        );
        body.insert(
            "model".into(),
            serde_json::Value::String(effective_model),
        );
        body.insert("customMode".into(), serde_json::Value::Bool(custom_mode));
        body.insert(
            "instrumental".into(),
            serde_json::Value::Bool(req.make_instrumental),
        );
        if let Some(style) = req
            .music_style
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            // Suno uses `style` on the new developer API; older surfaces use
            // `tags`. Emit both to be compatible.
            body.insert(
                "style".into(),
                serde_json::Value::String(style.to_string()),
            );
            body.insert(
                "tags".into(),
                serde_json::Value::String(style.to_string()),
            );
        }
        if let Some(lyrics) = req
            .lyrics
            .as_ref()
            .map(|s| s.trim())
            .filter(|s| !s.is_empty())
        {
            body.insert(
                "lyrics".into(),
                serde_json::Value::String(lyrics.to_string()),
            );
        }

        let body = serde_json::Value::Object(body);
        let resp = self.http.post(&url).json(&body).send().await?;
        let status = resp.status();
        let text = resp.text().await?;
        if !status.is_success() {
            return Err(MusicGenError::Upstream {
                status: status.as_u16(),
                body: text,
            });
        }
        let v: serde_json::Value =
            serde_json::from_str(&text).map_err(|e| MusicGenError::Upstream {
                status: status.as_u16(),
                body: format!("non-json response: {} ({})", e, text),
            })?;

        // The Suno developer API nests fields under `.data` while the raw
        // studio API returns them at the top level. Try both, plus a handful
        // of common field-name variants so a minor upstream tweak doesn't
        // break us.
        let task_id = extract_task_id(&v)
            .ok_or(MusicGenError::MissingField("taskId"))?
            .to_string();
        Ok(SunoSubmitAck { task_id })
    }

    async fn poll_until_done(
        &self,
        task: &SunoSubmitAck,
    ) -> Result<MusicGenResult, MusicGenError> {
        let started = std::time::Instant::now();
        let url = format!(
            "{}{}",
            self.cfg.base_url.trim_end_matches('/'),
            self.cfg.poll_path
        );
        loop {
            if started.elapsed() > self.cfg.overall_timeout {
                return Err(MusicGenError::Timeout(self.cfg.overall_timeout));
            }
            let resp = self
                .http
                .get(&url)
                .query(&[("taskId", task.task_id.as_str())])
                .send()
                .await?;
            let status = resp.status();
            let text = resp.text().await?;
            if !status.is_success() {
                // Only a definitive 4xx stops us. 5xx is treated as transient
                // within the overall_timeout budget.
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

            let state = extract_state(&v).to_ascii_uppercase();
            match state.as_str() {
                "SUCCESS" | "COMPLETE" | "COMPLETED" | "FINISHED" | "DONE" => {
                    return Ok(finalize_result(task, v));
                }
                "FIRST_SUCCESS" | "STREAMING" => {
                    if self.cfg.return_on_first_clip {
                        return Ok(finalize_result(task, v));
                    }
                    tokio::time::sleep(self.cfg.poll_interval).await;
                }
                "SENSITIVE_WORD_ERROR"
                | "CREATE_TASK_FAILED"
                | "GENERATE_AUDIO_FAILED"
                | "CALLBACK_EXCEPTION"
                | "FAILED"
                | "ERROR"
                | "CANCELED"
                | "CANCELLED" => {
                    return Err(MusicGenError::JobFailed(
                        extract_error_message(&v)
                            .unwrap_or_else(|| format!("suno job failed: status={}", state)),
                    ));
                }
                _ => {
                    tokio::time::sleep(self.cfg.poll_interval).await;
                }
            }
        }
    }
}

// ---------------------------------------------------------------- parsing

fn extract_task_id(v: &serde_json::Value) -> Option<&str> {
    // Developer API: { code, msg, data: { taskId } }
    if let Some(id) = v
        .get("data")
        .and_then(|d| d.get("taskId").or_else(|| d.get("task_id")))
        .and_then(|x| x.as_str())
    {
        return Some(id);
    }
    // Top-level task id (older studio API / some self-hosted wrappers).
    if let Some(id) = v
        .get("taskId")
        .or_else(|| v.get("task_id"))
        .or_else(|| v.get("id"))
        .and_then(|x| x.as_str())
    {
        return Some(id);
    }
    // Array-of-clips response shape: [{ id, ... }, { id, ... }] — we treat
    // the first clip id as the task id so a subsequent feed?ids=<id> call
    // still works. This matches the studio-api.suno.ai `/api/generate/v2/`
    // behaviour where the "task" is a pair of clips, each with its own id.
    if let Some(arr) = v.as_array() {
        if let Some(first) = arr.first() {
            if let Some(id) = first.get("id").and_then(|x| x.as_str()) {
                return Some(id);
            }
        }
    }
    None
}

fn extract_state(v: &serde_json::Value) -> String {
    // Developer API: data.status
    if let Some(s) = v
        .get("data")
        .and_then(|d| d.get("status"))
        .and_then(|x| x.as_str())
    {
        return s.to_string();
    }
    // Top-level status variants.
    if let Some(s) = v
        .get("status")
        .or_else(|| v.get("state"))
        .and_then(|x| x.as_str())
    {
        return s.to_string();
    }
    // Array shape: if all clips report complete, treat as SUCCESS.
    if let Some(arr) = v.as_array() {
        if !arr.is_empty()
            && arr.iter().all(|c| {
                c.get("status")
                    .and_then(|x| x.as_str())
                    .map(|s| {
                        let u = s.to_ascii_uppercase();
                        u == "COMPLETE" || u == "COMPLETED" || u == "STREAMING"
                    })
                    .unwrap_or(false)
            })
        {
            return "SUCCESS".into();
        }
    }
    "PENDING".into()
}

/// Map a user-facing version string to Suno's canonical model name.
///
/// Accepts common forms (`v4`, `V4`, `4`, `v4.5`, `4_5`, `v5`, ...) and
/// returns the Suno API's expected uppercase+underscore form (`V4`, `V4_5`,
/// `V5`, `V3_5`). Anything already in canonical form round-trips unchanged.
///
/// This is the only place version-string normalization happens — keeps the
/// "UI version vs upstream model" mapping in one spot so ops can tune it
/// without hunting through the submit body builder.
fn normalize_suno_model(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return "V5".into();
    }
    let upper = trimmed.to_ascii_uppercase();
    // Already canonical (e.g. "V4_5"): just strip dots and prepend V if missing.
    let stripped = upper.trim_start_matches('V');
    let normalized_body = stripped.replace('.', "_");
    format!("V{}", normalized_body)
}

fn extract_error_message(v: &serde_json::Value) -> Option<String> {
    v.get("data")
        .and_then(|d| d.get("errorMessage").or_else(|| d.get("error")))
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .or_else(|| {
            v.get("message")
                .or_else(|| v.get("msg"))
                .or_else(|| v.get("error"))
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
        })
}

fn extract_first_clip(v: &serde_json::Value) -> Option<&serde_json::Value> {
    // Developer API: data.response.sunoData[]
    if let Some(arr) = v
        .get("data")
        .and_then(|d| d.get("response"))
        .and_then(|r| r.get("sunoData"))
        .and_then(|x| x.as_array())
    {
        if let Some(first) = arr.first() {
            return Some(first);
        }
    }
    // Developer API alt: data.clips[]
    if let Some(arr) = v
        .get("data")
        .and_then(|d| d.get("clips"))
        .and_then(|x| x.as_array())
    {
        if let Some(first) = arr.first() {
            return Some(first);
        }
    }
    // Studio API: top-level array of clips.
    if let Some(arr) = v.as_array() {
        if let Some(first) = arr.first() {
            return Some(first);
        }
    }
    None
}

fn finalize_result(task: &SunoSubmitAck, v: serde_json::Value) -> MusicGenResult {
    let clip = extract_first_clip(&v).cloned().unwrap_or_else(|| v.clone());

    // Prefer the persistent mp3 URL; fall back to the ephemeral stream URL.
    let audio_url = clip
        .get("audioUrl")
        .or_else(|| clip.get("audio_url"))
        .and_then(|x| x.as_str())
        .or_else(|| {
            clip.get("streamAudioUrl")
                .or_else(|| clip.get("stream_audio_url"))
                .and_then(|x| x.as_str())
        })
        .unwrap_or_default()
        .to_string();

    let duration_secs = clip
        .get("duration")
        .or_else(|| clip.get("duration_secs"))
        .and_then(|x| x.as_f64());

    let title = clip
        .get("title")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    let conversion_id = clip
        .get("id")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string());

    // CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
    // Suno v5 returns word-level alignment under
    // `clip.metadata.alignedWords` (or `aligned_words` depending on API rev).
    // Extract from `clip` first (the per-clip envelope we already located),
    // then fall back to the top-level payload `v` in case the field migrates.
    let aligned_lyrics = crate::music_gen::extract_aligned_lyrics(&clip)
        .or_else(|| crate::music_gen::extract_aligned_lyrics(&v));

    MusicGenResult {
        task_id: task.task_id.clone(),
        conversion_id,
        audio_url,
        format: "mp3".to_string(),
        duration_secs,
        title,
        raw: v,
        aligned_lyrics,
    }
}
