// CSSOS_PHASE2_RUNWAY 20260417 — Runway ML HTTP adapter.
//
// Covers both MVP surfaces the pipeline needs:
//   * `text_to_image`  → album-cover generation (Runway Gen-4 image)
//   * `image_to_video` → scene video (Runway Gen-3a / Gen-4 turbo)
//
// Transport shape (per api.dev.runwayml.com):
//   POST /v1/text_to_image  { promptText, ratio, model, ... }
//       → { id, status }
//   POST /v1/image_to_video { promptImage, promptText, ratio, duration, model }
//       → { id, status }
//   GET  /v1/tasks/{id}     → { status, output: [url] | null, ... }
//
// Required headers:
//   Authorization: Bearer <API_KEY>
//   X-Runway-Version: 2024-11-06   ← required; API rejects calls without it
//
// This module is async-first; the synchronous `VideoBackend` trait impl on the
// bottom of the file wraps `.block_on` onto a tokio runtime because the
// existing pipeline dispatcher is still synchronous. New `/api/mv/*` endpoints
// call the async methods directly.

use std::time::Duration;

use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde::{Deserialize, Serialize};
use thiserror::Error;

use super::router::VideoBackend;
use super::types::{RenderOptions, RenderResult, SceneInput};

const DEFAULT_BASE_URL: &str = "https://api.dev.runwayml.com";
const DEFAULT_API_VERSION: &str = "2024-11-06";
const DEFAULT_POLL_INTERVAL_SECS: u64 = 5;
// P2-24 Jing 2026-04-18: lowered from 600s → 240s so the backend fails
// fast(er) when Runway stalls. The frontend caps the /api/mv/video call
// at 180s already; keeping the backend at 600s meant 420s of wasted
// polling after the client had already given up. Still overridable via
// `RUNWAY_TIMEOUT_SECS` env var for long-form renders.
const DEFAULT_TIMEOUT_SECS: u64 = 240;
const DEFAULT_HTTP_TIMEOUT_SECS: u64 = 60;

#[derive(Debug, Clone)]
pub struct RunwayConfig {
    pub api_key: String,
    pub base_url: String,
    pub api_version: String,
    pub poll_interval: Duration,
    pub overall_timeout: Duration,
    pub http_timeout: Duration,
}

impl RunwayConfig {
    pub fn from_env() -> Option<Self> {
        let api_key = std::env::var("RUNWAY_API_KEY").ok()?;
        let api_key = api_key.trim().to_string();
        if api_key.is_empty() {
            return None;
        }
        Some(Self::with_api_key_and_env(api_key))
    }

    /// CSSOS_PHASE2_BYOK 20260420 — BYOK constructor. Uses the user-supplied
    /// API key, inherits every other knob (base URL, version, timeouts) from
    /// env overrides so ops can still A/B a sandbox endpoint without touching
    /// the per-user rows. Empty key gets rejected at the upper layer
    /// (engine_credentials::api::upsert_key requires >= 8 chars).
    pub fn with_api_key(api_key: String) -> Self {
        Self::with_api_key_and_env(api_key)
    }

    fn with_api_key_and_env(api_key: String) -> Self {
        let base_url = std::env::var("RUNWAY_BASE_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_BASE_URL.to_string());
        let api_version = std::env::var("RUNWAY_API_VERSION")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_API_VERSION.to_string());
        let poll_interval = std::env::var("RUNWAY_POLL_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_POLL_INTERVAL_SECS);
        let overall_timeout = std::env::var("RUNWAY_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_TIMEOUT_SECS);
        let http_timeout = std::env::var("RUNWAY_HTTP_TIMEOUT_SECS")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_HTTP_TIMEOUT_SECS);
        Self {
            api_key,
            base_url,
            api_version,
            poll_interval: Duration::from_secs(poll_interval),
            overall_timeout: Duration::from_secs(overall_timeout),
            http_timeout: Duration::from_secs(http_timeout),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunwayImageRequest {
    pub prompt: String,
    #[serde(default)]
    pub ratio: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub seed: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunwayVideoRequest {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunwayAsset {
    pub task_id: String,
    pub output_url: String,
    pub model: String,
    pub raw: serde_json::Value,
}

/// CSSOS_PHASE2_BYOK 20260420 — shape of `GET /v1/organization`. Surfaced by
/// `whoami()` so the BYOK settings UI can show "Runway · 5,000 credits ·
/// valid" next to the key row. Every field is optional because Runway's org
/// response differs between plan tiers; we preserve `raw` so the UI can fall
/// back to the full JSON if a field is missing.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct RunwayOrgInfo {
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default, rename = "creditBalance")]
    pub credit_balance: Option<i64>,
    #[serde(default)]
    pub tier: Option<String>,
    #[serde(default, skip_serializing_if = "serde_json::Value::is_null")]
    pub raw: serde_json::Value,
}

#[derive(Debug, Error)]
pub enum RunwayError {
    #[error("Runway is not configured (set RUNWAY_API_KEY)")]
    NotConfigured,
    #[error("Runway transport error: {0}")]
    Transport(#[from] reqwest::Error),
    #[error("Runway responded with status {status}: {body}")]
    Upstream { status: u16, body: String },
    #[error("Runway task timed out after {0:?}")]
    Timeout(Duration),
    #[error("Runway task failed: {0}")]
    TaskFailed(String),
    #[error("Runway response was missing a required field: {0}")]
    MissingField(&'static str),
}

#[derive(Clone)]
pub struct RunwayClient {
    cfg: RunwayConfig,
    http: reqwest::Client,
}

impl RunwayClient {
    pub fn new(cfg: RunwayConfig) -> Result<Self, RunwayError> {
        let mut headers = HeaderMap::new();
        let bearer = format!("Bearer {}", cfg.api_key);
        if let Ok(v) = HeaderValue::from_str(&bearer) {
            headers.insert(AUTHORIZATION, v);
        }
        if let Ok(v) = HeaderValue::from_str(&cfg.api_version) {
            headers.insert("X-Runway-Version", v);
        }
        let http = reqwest::Client::builder()
            .timeout(cfg.http_timeout)
            .default_headers(headers)
            .user_agent("cssos-rust-api/phase2-runway")
            .build()?;
        Ok(Self { cfg, http })
    }

    pub fn from_env() -> Result<Self, RunwayError> {
        match RunwayConfig::from_env() {
            Some(cfg) => Self::new(cfg),
            None => Err(RunwayError::NotConfigured),
        }
    }

    pub async fn text_to_image(
        &self,
        req: &RunwayImageRequest,
    ) -> Result<RunwayAsset, RunwayError> {
        let model = req.model.clone().unwrap_or_else(|| "gen4_image".into());
        let ratio = req.ratio.clone().unwrap_or_else(|| "1024:1024".into());
        let mut body = serde_json::json!({
            "promptText": req.prompt,
            "ratio": ratio,
            "model": model,
        });
        if let Some(seed) = req.seed {
            body["seed"] = serde_json::Value::from(seed);
        }
        let task_id = self.submit("/v1/text_to_image", body).await?;
        let raw = self.poll_task(&task_id).await?;
        let output_url = first_output_url(&raw)?;
        Ok(RunwayAsset {
            task_id,
            output_url,
            model,
            raw,
        })
    }

    /// CSSOS_PHASE2_BYOK 20260420 — lightweight round-trip used to validate
    /// a user-supplied key when they save it. Hits `GET /v1/organization`;
    /// returns the JSON decoded into `RunwayOrgInfo` with the raw payload
    /// preserved for any fields Runway adds later. Any non-2xx maps to
    /// Upstream so the settings panel can render the upstream error verbatim.
    pub async fn whoami(&self) -> Result<RunwayOrgInfo, RunwayError> {
        let url = format!("{}/v1/organization", self.cfg.base_url);
        let resp = self.http.get(&url).send().await?;
        let status = resp.status();
        let text = resp.text().await?;
        if !status.is_success() {
            return Err(RunwayError::Upstream {
                status: status.as_u16(),
                body: text,
            });
        }
        let raw: serde_json::Value =
            serde_json::from_str(&text).map_err(|e| RunwayError::Upstream {
                status: status.as_u16(),
                body: format!("non-json response: {} ({})", e, text),
            })?;
        let mut info: RunwayOrgInfo = serde_json::from_value(raw.clone()).unwrap_or_default();
        info.raw = raw;
        Ok(info)
    }

    pub async fn image_to_video(
        &self,
        req: &RunwayVideoRequest,
    ) -> Result<RunwayAsset, RunwayError> {
        let model = req.model.clone().unwrap_or_else(|| "gen3a_turbo".into());
        let ratio = req.ratio.clone().unwrap_or_else(|| "1280:768".into());
        let duration = req.duration_secs.unwrap_or(5);
        let mut body = serde_json::json!({
            "promptImage": req.prompt_image_url,
            "model": model,
            "ratio": ratio,
            "duration": duration,
        });
        if let Some(text) = &req.prompt_text {
            if !text.is_empty() {
                body["promptText"] = serde_json::Value::from(text.clone());
            }
        }
        let task_id = self.submit("/v1/image_to_video", body).await?;
        let raw = self.poll_task(&task_id).await?;
        let output_url = first_output_url(&raw)?;
        Ok(RunwayAsset {
            task_id,
            output_url,
            model,
            raw,
        })
    }

    async fn submit(
        &self,
        path: &str,
        body: serde_json::Value,
    ) -> Result<String, RunwayError> {
        let url = format!("{}{}", self.cfg.base_url, path);
        let resp = self.http.post(&url).json(&body).send().await?;
        let status = resp.status();
        let text = resp.text().await?;
        if !status.is_success() {
            return Err(RunwayError::Upstream {
                status: status.as_u16(),
                body: text,
            });
        }
        let v: serde_json::Value =
            serde_json::from_str(&text).map_err(|e| RunwayError::Upstream {
                status: status.as_u16(),
                body: format!("non-json response: {} ({})", e, text),
            })?;
        v.get("id")
            .and_then(|x| x.as_str())
            .map(|s| s.to_string())
            .ok_or(RunwayError::MissingField("id"))
    }

    async fn poll_task(&self, id: &str) -> Result<serde_json::Value, RunwayError> {
        let started = std::time::Instant::now();
        let url = format!("{}/v1/tasks/{}", self.cfg.base_url, id);
        loop {
            if started.elapsed() > self.cfg.overall_timeout {
                return Err(RunwayError::Timeout(self.cfg.overall_timeout));
            }
            let resp = self.http.get(&url).send().await?;
            let status = resp.status();
            let text = resp.text().await?;
            if !status.is_success() {
                if status.is_client_error() {
                    return Err(RunwayError::Upstream {
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
                .and_then(|x| x.as_str())
                .unwrap_or("PENDING")
                .to_ascii_uppercase();
            match state.as_str() {
                "SUCCEEDED" | "SUCCESS" | "COMPLETED" => return Ok(v),
                "FAILED" | "CANCELLED" | "CANCELED" | "ERROR" => {
                    return Err(RunwayError::TaskFailed(
                        v.get("failure")
                            .and_then(|x| x.as_str())
                            .or_else(|| v.get("error").and_then(|x| x.as_str()))
                            .unwrap_or("task failed")
                            .to_string(),
                    ));
                }
                _ => tokio::time::sleep(self.cfg.poll_interval).await,
            }
        }
    }
}

fn first_output_url(v: &serde_json::Value) -> Result<String, RunwayError> {
    v.get("output")
        .and_then(|x| x.as_array())
        .and_then(|arr| arr.first())
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .ok_or(RunwayError::MissingField("output[0]"))
}

// --------------------------------------------------------------------------
// VideoBackend trait impl — lets the existing synchronous dispatcher route to
// Runway when allow_external=true. For an MVP we only call this path from the
// new /api/mv/* surface; the production DAG still defaults to local.
// --------------------------------------------------------------------------

pub struct RunwayVideoBackend {
    client: Option<RunwayClient>,
}

impl RunwayVideoBackend {
    pub fn from_env() -> Self {
        Self {
            client: RunwayClient::from_env().ok(),
        }
    }
}

impl VideoBackend for RunwayVideoBackend {
    fn name(&self) -> &'static str {
        "runway"
    }

    fn render_scene(
        &self,
        scene: &SceneInput,
        _options: &RenderOptions,
    ) -> Result<RenderResult> {
        let client = self
            .client
            .clone()
            .ok_or_else(|| anyhow!("runway backend not configured"))?;
        let prompt_image = scene
            .style_hint
            .clone()
            .ok_or_else(|| anyhow!("runway render_scene requires style_hint=image_url"))?;
        let duration = (scene.duration_secs.round() as i64).max(1).min(10) as u32;
        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()?;
        let prompt_text = if scene.visual_script.is_empty() {
            None
        } else {
            Some(scene.visual_script.clone())
        };
        let asset = rt.block_on(async move {
            client
                .image_to_video(&RunwayVideoRequest {
                    prompt_image_url: prompt_image,
                    prompt_text,
                    ratio: None,
                    model: None,
                    duration_secs: Some(duration),
                })
                .await
        })?;
        Ok(RenderResult {
            scene_id: scene.id,
            backend: self.name().to_string(),
            output_path: asset.output_url,
        })
    }

    fn is_available(&self) -> bool {
        self.client.is_some()
    }
}
