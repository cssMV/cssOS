// CSSOS_PHASE2_LLM_ANTHROPIC 20260418 — Anthropic messages API adapter.
//
// Uses ANTHROPIC_API_KEY from /etc/cssos.env. Hits /v1/messages with the
// standard `x-api-key` + `anthropic-version` headers.
//
// Override env vars:
//   ANTHROPIC_API_URL     — full endpoint (defaults to api.anthropic.com/v1/messages)
//   ANTHROPIC_VERSION     — API version header (defaults to 2023-06-01)
//   ANTHROPIC_TIMEOUT     — HTTP timeout in seconds (default 60)
//
// Model strings per Anthropic's latest naming (see product_information in the
// Claude behavior block): `claude-opus-4-6`, `claude-sonnet-4-6`,
// `claude-haiku-4-5-20251001`.

use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde_json::{json, Value};

use super::{ChatRequest, ChatResult, LlmError};

const DEFAULT_ENDPOINT: &str = "https://api.anthropic.com/v1/messages";
const DEFAULT_VERSION: &str = "2023-06-01";
const DEFAULT_HTTP_TIMEOUT_SECS: u64 = 60;

pub struct AnthropicClient {
    http: reqwest::Client,
    endpoint: String,
}

impl AnthropicClient {
    pub fn from_env() -> Result<Self, LlmError> {
        let api_key = std::env::var("ANTHROPIC_API_KEY")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .ok_or(LlmError::NotConfigured)?;
        let endpoint = std::env::var("ANTHROPIC_API_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_ENDPOINT.to_string());
        let version = std::env::var("ANTHROPIC_VERSION")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_VERSION.to_string());
        let timeout = std::env::var("ANTHROPIC_TIMEOUT")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_HTTP_TIMEOUT_SECS);

        let mut headers = HeaderMap::new();
        if let Ok(v) = HeaderValue::from_str(&api_key) {
            if let Ok(name) = HeaderName::from_bytes(b"x-api-key") {
                headers.insert(name, v);
            }
        }
        if let Ok(v) = HeaderValue::from_str(&version) {
            if let Ok(name) = HeaderName::from_bytes(b"anthropic-version") {
                headers.insert(name, v);
            }
        }
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout))
            .default_headers(headers)
            .user_agent("cssos-rust-api/phase2-anthropic")
            .build()?;
        Ok(Self { http, endpoint })
    }

    pub async fn generate(&self, req: &ChatRequest) -> Result<ChatResult, LlmError> {
        let mut payload = json!({
            "model": req.model,
            "max_tokens": req.max_tokens,
            "messages": [
                {"role": "user", "content": req.user.clone()}
            ],
        });
        if let Some(sys) = req.system.as_deref() {
            if !sys.is_empty() {
                payload["system"] = json!(sys);
            }
        }
        if let Some(t) = req.temperature {
            payload["temperature"] = json!(t);
        }

        let resp = self.http.post(&self.endpoint).json(&payload).send().await?;
        let status = resp.status();
        let body = resp.text().await?;
        if !status.is_success() {
            return Err(LlmError::Upstream {
                status: status.as_u16(),
                body,
            });
        }
        let v: Value = serde_json::from_str(&body).map_err(|e| LlmError::Upstream {
            status: status.as_u16(),
            body: format!("non-json response: {} ({})", e, body),
        })?;

        // Anthropic response: {"content":[{"type":"text","text":"..."}], "usage":{...}}
        let text = v
            .get("content")
            .and_then(Value::as_array)
            .map(|arr| {
                arr.iter()
                    .filter_map(|blk| blk.get("text").and_then(Value::as_str))
                    .collect::<Vec<_>>()
                    .join("\n")
            })
            .filter(|s| !s.is_empty())
            .ok_or(LlmError::MissingField("content[].text"))?;
        let input_tokens = v
            .get("usage")
            .and_then(|u| u.get("input_tokens"))
            .and_then(Value::as_u64)
            .map(|n| n as u32);
        let output_tokens = v
            .get("usage")
            .and_then(|u| u.get("output_tokens"))
            .and_then(Value::as_u64)
            .map(|n| n as u32);

        Ok(ChatResult {
            text,
            model: req.model.clone(),
            provider: "anthropic".to_string(),
            input_tokens,
            output_tokens,
            raw: v,
        })
    }
}
