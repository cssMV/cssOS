// CSSOS_PHASE2_STABLE_AUDIO 20260419 — Stability AI Stable Audio 2.0 adapter.
//
// Stability AI's dedicated audio API lives at
// `POST https://api.stability.ai/v2beta/audio/stable-audio-2/text-to-audio`
// and shares the `STABILITY_API_KEY` (Bearer) already used by our Stability
// SDXL cover engine — one key, two services. Output is mp3/wav bytes up to
// ~180 seconds. Strong instrumental / ambient / SFX coverage — deliberately
// NOT in the same lane as Suno / MusicGPT / ElevenLabs Music (which do
// vocals-first songs). This is the "user wants a score, not a song" engine.
//
// Flow is synchronous by default: the POST returns audio bytes directly.
// We stash those bytes under `STABILITY_AUDIO_CACHE_DIR` (env, defaults
// to `/tmp/cssos-music`) and return a `file://` URL that pipeline_mv_api
// snapshots into work_assets. If ops points us at an async gateway, set
// `STABILITY_AUDIO_ASYNC=1` + `STABILITY_AUDIO_POLL_PATH` and we submit →
// poll like Suno.
//
// All tunables (base URL, endpoint, model, duration, output format) are
// env-overridable. Degrades cleanly to MusicGenError::NotConfigured when
// STABILITY_API_KEY is absent — the engine_registry mirrors this so the
// UI never surfaces the engine without a key.

// CSSOS_PHASE2_BYOK_STABILITY 20260420 — BYOK constructor + whoami.
// Mirrors the Runway / ElevenLabs pattern: `with_api_key()` lets the
// per-user credential resolver mint a client from a plaintext key pulled
// out of engine_credentials, and `whoami()` hits Stability's platform
// account + balance endpoints so the Settings test button returns a
// human-readable "ok · N credits" payload.

use std::path::PathBuf;
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use reqwest::multipart;
use serde::{Deserialize, Serialize};

use super::musicgpt::{MusicGenError, MusicGenRequest, MusicGenResult};

const DEFAULT_BASE_URL: &str = "https://api.stability.ai";
const DEFAULT_SUBMIT_PATH: &str = "/v2beta/audio/stable-audio-2/text-to-audio";
const DEFAULT_POLL_PATH: &str = "/v2beta/audio/stable-audio-2/result";
const DEFAULT_MODEL: &str = "stable-audio-2";
const DEFAULT_OUTPUT_FORMAT: &str = "mp3";
const DEFAULT_DURATION_SECS: u64 = 30;
const DEFAULT_POLL_INTERVAL_SECS: u64 = 4;
const DEFAULT_TIMEOUT_SECS: u64 = 600;
const DEFAULT_HTTP_TIMEOUT_SECS: u64 = 180;
const DEFAULT_CACHE_DIR: &str = "/tmp/cssos-music";

#[derive(Debug, Clone)]
pub struct StableAudioConfig {
    pub api_key: String,
    pub base_url: String,
    pub submit_path: String,
    pub poll_path: String,
    pub model: String,
    pub output_format: String,
    pub duration_secs: u64,
    pub poll_interval: Duration,
    pub overall_timeout: Duration,
    pub http_timeout: Duration,
    pub async_mode: bool,
    pub cache_dir: PathBuf,
}

impl StableAudioConfig {
    pub fn from_env() -> Option<Self> {
        let api_key = std::env::var("STABILITY_API_KEY").ok()?;
        let api_key = api_key.trim().to_string();
        if api_key.is_empty() {
            return None;
        }
        Some(Self::with_api_key_and_env(api_key))
    }

    /// BYOK constructor: build a StableAudioConfig from a plaintext API key
    /// that came from the engine_credentials resolver. Honors the same
    /// STABILITY_AUDIO_* env overrides for base URL / model / duration so
    /// ops tuning still applies when the user is supplying their own key.
    pub fn with_api_key(api_key: String) -> Self {
        Self::with_api_key_and_env(api_key)
    }

    fn with_api_key_and_env(api_key: String) -> Self {
        let base_url = env_or(
            &["STABILITY_AUDIO_BASE_URL", "STABILITY_BASE_URL"],
            DEFAULT_BASE_URL,
        );
        let submit_path = env_or(&["STABILITY_AUDIO_SUBMIT_PATH"], DEFAULT_SUBMIT_PATH);
        let poll_path = env_or(&["STABILITY_AUDIO_POLL_PATH"], DEFAULT_POLL_PATH);
        let model = env_or(&["STABILITY_AUDIO_MODEL"], DEFAULT_MODEL);
        let output_format = env_or(&["STABILITY_AUDIO_OUTPUT_FORMAT"], DEFAULT_OUTPUT_FORMAT);
        let duration_secs = std::env::var("STABILITY_AUDIO_DURATION_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_DURATION_SECS);
        let poll_interval = std::env::var("STABILITY_AUDIO_POLL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_POLL_INTERVAL_SECS);
        let overall_timeout = std::env::var("STABILITY_AUDIO_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_TIMEOUT_SECS);
        let http_timeout = std::env::var("STABILITY_AUDIO_HTTP_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_HTTP_TIMEOUT_SECS);
        let async_mode = std::env::var("STABILITY_AUDIO_ASYNC")
            .ok()
            .map(|s| {
                let t = s.trim().to_ascii_lowercase();
                t == "1" || t == "true" || t == "yes"
            })
            .unwrap_or(false);
        let cache_dir = std::env::var("STABILITY_AUDIO_CACHE_DIR")
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
            model,
            output_format,
            duration_secs,
            poll_interval: Duration::from_secs(poll_interval),
            overall_timeout: Duration::from_secs(overall_timeout),
            http_timeout: Duration::from_secs(http_timeout),
            async_mode,
            cache_dir,
        }
    }
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

pub struct StableAudioClient {
    cfg: StableAudioConfig,
    http: reqwest::Client,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct SubmitAck {
    task_id: String,
    audio_url: Option<String>,
    inline_bytes: Option<Vec<u8>>,
    inline_format: Option<String>,
}

/// Flattened account + credits view returned by `whoami()`. Serialized
/// directly onto the `/api/settings/engine-keys/:engine/test` response
/// under `detail` so the Settings card can render a
/// `stability ok · 12,345 credits` toast.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StabilityAccountInfo {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub organization: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credits: Option<f64>,
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub raw_account: serde_json::Value,
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub raw_balance: serde_json::Value,
}

impl StableAudioClient {
    pub fn new(cfg: StableAudioConfig) -> Result<Self, MusicGenError> {
        let mut headers = HeaderMap::new();
        if let Ok(v) = HeaderValue::from_str(&format!("Bearer {}", cfg.api_key)) {
            headers.insert(AUTHORIZATION, v);
        }
        // Default accept — bias toward JSON when async, audio bytes when sync.
        // Upstream still respects the explicit Accept we set per-request below.
        // CSSOS_PHASE2_STABILITY_TCP_TUNE 20260425 #119 — same TCP keepalive
        // tuning we apply to MusicGPT/Suno/ElevenLabs for long polling.
        let http = reqwest::Client::builder()
            .timeout(cfg.http_timeout)
            .connect_timeout(std::time::Duration::from_secs(10))
            .tcp_keepalive(Some(std::time::Duration::from_secs(30)))
            .pool_max_idle_per_host(2)
            .default_headers(headers)
            .user_agent("cssos-rust-api/phase2-stable-audio")
            .build()?;
        Ok(Self { cfg, http })
    }

    pub fn from_env() -> Result<Self, MusicGenError> {
        match StableAudioConfig::from_env() {
            Some(cfg) => Self::new(cfg),
            None => Err(MusicGenError::NotConfigured {
                engine: "Stable Audio",
                env_var: "STABILITY_API_KEY",
            }),
        }
    }

    /// Lightweight account probe for the Settings → Test button.
    /// Hits Stability's `/v1/user/account` (profile/email) and
    /// `/v1/user/balance` (credits). Either endpoint may 404 on
    /// enterprise / team keys — we tolerate partial success and only
    /// error out if neither responds.
    ///
    /// Uses the v1 REST surface, not the v2beta audio one, because those
    /// platform-level endpoints live under /v1 across every Stability
    /// product. The `STABILITY_BASE_URL` env applies here too so an
    /// enterprise proxy still works.
    pub async fn whoami(&self) -> Result<StabilityAccountInfo, MusicGenError> {
        let base = self.cfg.base_url.trim_end_matches('/').to_string();
        let acct_url = format!("{}/v1/user/account", base);
        let bal_url = format!("{}/v1/user/balance", base);

        let acct_resp = self.http.get(&acct_url).send().await;
        let bal_resp = self.http.get(&bal_url).send().await;

        let mut info = StabilityAccountInfo::default();
        let mut any_ok = false;
        let mut last_err: Option<(u16, String)> = None;

        if let Ok(r) = acct_resp {
            let status = r.status();
            let text = r.text().await.unwrap_or_default();
            if status.is_success() {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                    info.id = v.get("id").and_then(|x| x.as_str()).map(|s| s.to_string());
                    info.email = v
                        .get("email")
                        .and_then(|x| x.as_str())
                        .map(|s| s.to_string());
                    // Stability returns `profile_picture` / `organizations`;
                    // grab org name if present for display.
                    info.organization = v
                        .get("organizations")
                        .and_then(|x| x.as_array())
                        .and_then(|arr| arr.first())
                        .and_then(|o| o.get("name"))
                        .and_then(|x| x.as_str())
                        .map(|s| s.to_string());
                    info.raw_account = v;
                    any_ok = true;
                }
            } else {
                last_err = Some((status.as_u16(), text));
            }
        }

        if let Ok(r) = bal_resp {
            let status = r.status();
            let text = r.text().await.unwrap_or_default();
            if status.is_success() {
                if let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) {
                    info.credits = v.get("credits").and_then(|x| x.as_f64());
                    info.raw_balance = v;
                    any_ok = true;
                }
            } else if last_err.is_none() {
                last_err = Some((status.as_u16(), text));
            }
        }

        if !any_ok {
            let (status, body) = last_err.unwrap_or((502, "stability whoami failed".to_string()));
            return Err(MusicGenError::Upstream { status, body });
        }
        Ok(info)
    }

    pub async fn generate(
        &self,
        req: &MusicGenRequest,
    ) -> Result<MusicGenResult, MusicGenError> {
        let ack = self.submit(req).await?;

        // Sync path.
        if let Some(url) = ack.audio_url.clone() {
            return Ok(finalize_from_url(&ack, url, self.cfg.output_format.clone()));
        }
        if let (Some(bytes), Some(fmt)) = (
            ack.inline_bytes.as_ref(),
            ack.inline_format.as_ref().cloned(),
        ) {
            let url = self.cache_bytes_to_local_url(&ack.task_id, bytes, &fmt)?;
            return Ok(finalize_from_url(&ack, url, fmt));
        }

        // Async path.
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

        // Stable Audio 2 uses multipart/form-data with fields: prompt,
        // duration, output_format, model. Style/lyrics get folded into the
        // prompt (Stable Audio is prompt-only — it doesn't do vocals).
        let composed_prompt = compose_prompt(req);
        let duration_str = self.cfg.duration_secs.to_string();
        let form = multipart::Form::new()
            .text("prompt", composed_prompt)
            .text("duration", duration_str)
            .text("output_format", self.cfg.output_format.clone())
            .text("model", self.cfg.model.clone());

        // Accept header decides sync bytes vs async JSON. When async_mode is
        // on we ask for JSON so we get a generation_id to poll.
        let accept = if self.cfg.async_mode {
            "application/json"
        } else {
            // Stability returns the raw audio when we accept the exact
            // output format; use a permissive audio/* plus json fallback.
            match self.cfg.output_format.as_str() {
                "wav" => "audio/wav, application/json",
                _ => "audio/mpeg, application/json",
            }
        };

        let resp = self
            .http
            .post(&url)
            .header(reqwest::header::ACCEPT, accept)
            .multipart(form)
            .send()
            .await?;
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

        if content_type.starts_with("application/json") {
            let text = resp.text().await?;
            let v: serde_json::Value =
                serde_json::from_str(&text).map_err(|e| MusicGenError::Upstream {
                    status: status.as_u16(),
                    body: format!("non-json despite content-type: {} ({})", e, text),
                })?;
            let task_id = v
                .get("id")
                .or_else(|| v.get("generation_id"))
                .or_else(|| v.get("task_id"))
                .and_then(|x| x.as_str())
                .unwrap_or("stability-sync")
                .to_string();
            let audio_url = v
                .get("audio_url")
                .or_else(|| v.get("url"))
                .and_then(|x| x.as_str())
                .map(|s| s.to_string());
            // Stability sometimes returns the audio inline as base64 under
            // `audio` — decode if present so downstream sees bytes.
            let inline_b64 = v.get("audio").and_then(|x| x.as_str());
            let inline_bytes = inline_b64.and_then(|s| base64_decode_lossy(s));
            return Ok(SubmitAck {
                task_id,
                audio_url,
                inline_bytes,
                inline_format: Some(self.cfg.output_format.clone()),
            });
        }

        // Binary audio path.
        let bytes = resp.bytes().await?.to_vec();
        let inline_format = if content_type.contains("wav") {
            "wav".to_string()
        } else {
            "mp3".to_string()
        };
        let task_id = format!("stability-sync-{}", short_hash(&bytes));
        Ok(SubmitAck {
            task_id,
            audio_url: None,
            inline_bytes: Some(bytes),
            inline_format: Some(inline_format),
        })
    }

    fn cache_bytes_to_local_url(
        &self,
        task_id: &str,
        bytes: &[u8],
        fmt: &str,
    ) -> Result<String, MusicGenError> {
        std::fs::create_dir_all(&self.cfg.cache_dir).map_err(|e| MusicGenError::Upstream {
            status: 0,
            body: format!("cache_dir create failed: {}", e),
        })?;
        let filename = format!("{}.{}", task_id, fmt);
        let path = self.cfg.cache_dir.join(&filename);
        std::fs::write(&path, bytes).map_err(|e| MusicGenError::Upstream {
            status: 0,
            body: format!("cache write failed: {}", e),
        })?;
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
                "completed" | "success" | "succeeded" | "done" | "ready" | "finished" => {
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
                    return Ok(MusicGenResult {
                        task_id: ack.task_id.clone(),
                        conversion_id: None,
                        audio_url,
                        format: self.cfg.output_format.clone(),
                        duration_secs,
                        title: None,
                        raw: v,
                        // Stable Audio is instrumental-focused and does not
                        // expose lyric alignment. Subtitles fall back to
                        // even-divide for this engine. (#148-D)
                        aligned_lyrics: None,
                    });
                }
                "failed" | "error" | "canceled" | "cancelled" => {
                    return Err(MusicGenError::JobFailed(
                        v.get("error")
                            .and_then(|x| x.as_str())
                            .unwrap_or("stable audio job failed")
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
    // Stable Audio 2.0 is prompt-only (no separate lyrics/style fields), and
    // doesn't do vocals meaningfully. If the caller passed `make_instrumental`
    // we already match intent; if they pass lyrics we fold them in as a
    // descriptive hint rather than sung content.
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
    if let Some(_lyr) = req
        .lyrics
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty())
    {
        // Explicitly hint instrumental framing — Stable Audio can't sing.
        parts.push("instrumental arrangement".to_string());
    } else if req.make_instrumental {
        parts.push("instrumental only".to_string());
    }
    parts.retain(|s| !s.is_empty());
    parts.join(". ")
}

fn finalize_from_url(ack: &SubmitAck, audio_url: String, format: String) -> MusicGenResult {
    MusicGenResult {
        task_id: ack.task_id.clone(),
        conversion_id: None,
        audio_url,
        format,
        duration_secs: None,
        title: None,
        raw: serde_json::Value::Null,
        aligned_lyrics: None, // #148-D — instrumental engine, no alignment
    }
}

fn short_hash(bytes: &[u8]) -> String {
    let mut h: u64 = 5381;
    for &b in bytes.iter().take(4096) {
        h = h.wrapping_mul(33) ^ b as u64;
    }
    format!("{:x}", h)
}

/// Minimal best-effort base64 decoder (handles both standard and URL-safe).
/// Returns None on any malformed input — we'd rather fall back to polling
/// than return corrupted bytes.
fn base64_decode_lossy(s: &str) -> Option<Vec<u8>> {
    use std::convert::TryInto;
    let trimmed: String = s.chars().filter(|c| !c.is_whitespace()).collect();
    let trimmed = trimmed.replace('-', "+").replace('_', "/");
    // Pad to multiple of 4.
    let pad = (4 - trimmed.len() % 4) % 4;
    let padded = format!("{}{}", trimmed, "=".repeat(pad));
    let bytes = padded.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(padded.len() * 3 / 4);
    let mut chunk = [0u8; 4];
    let mut idx = 0usize;
    for b in bytes {
        let v: i16 = match *b {
            b'A'..=b'Z' => (*b - b'A') as i16,
            b'a'..=b'z' => (*b - b'a' + 26) as i16,
            b'0'..=b'9' => (*b - b'0' + 52) as i16,
            b'+' => 62,
            b'/' => 63,
            b'=' => -1,
            _ => return None,
        };
        chunk[idx] = if v < 0 { 0 } else { v as u8 };
        idx += 1;
        if idx == 4 {
            let packed = ((chunk[0] as u32) << 18)
                | ((chunk[1] as u32) << 12)
                | ((chunk[2] as u32) << 6)
                | (chunk[3] as u32);
            out.push(((packed >> 16) & 0xff) as u8);
            let mid = ((packed >> 8) & 0xff) as u8;
            let lo = (packed & 0xff) as u8;
            if bytes[bytes.len() - 2] != b'=' || idx != 4 {
                out.push(mid);
            }
            if bytes[bytes.len() - 1] != b'=' || idx != 4 {
                out.push(lo);
            }
            idx = 0;
        }
    }
    // Suppress the unused TryInto import on some toolchains.
    let _: [u8; 0] = [0u8; 0].try_into().ok()?;
    Some(out)
}
