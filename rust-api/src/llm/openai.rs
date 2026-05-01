// CSSOS_PHASE2_LLM_OPENAI 20260418 — OpenAI chat completions adapter.
//
// Uses the same OPENAI_API_KEY that already powers video/openai_client.rs,
// but hits /v1/chat/completions instead of /v1/images/generations.
//
// Override env vars:
//   OPENAI_CHAT_URL      — full endpoint (defaults to api.openai.com/v1/chat/completions)
//   OPENAI_CHAT_TIMEOUT  — HTTP request timeout in seconds (default 60)
//
// Returned `ChatResult.model` echoes what we asked for so the caller can
// persist a verifiable engine+version pair in billing meta.

use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION};
use serde_json::{json, Value};

use super::{ChatRequest, ChatResult, LlmError};

const DEFAULT_ENDPOINT: &str = "https://api.openai.com/v1/chat/completions";
const DEFAULT_HTTP_TIMEOUT_SECS: u64 = 60;

pub struct OpenAiChatClient {
    http: reqwest::Client,
    endpoint: String,
}

impl OpenAiChatClient {
    pub fn from_env() -> Result<Self, LlmError> {
        let api_key = std::env::var("OPENAI_API_KEY")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .ok_or(LlmError::NotConfigured)?;
        let endpoint = std::env::var("OPENAI_CHAT_URL")
            .ok()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| DEFAULT_ENDPOINT.to_string());
        let timeout = std::env::var("OPENAI_CHAT_TIMEOUT")
            .ok()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(DEFAULT_HTTP_TIMEOUT_SECS);

        let mut headers = HeaderMap::new();
        let bearer = format!("Bearer {}", api_key);
        if let Ok(v) = HeaderValue::from_str(&bearer) {
            headers.insert(AUTHORIZATION, v);
        }
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(timeout))
            .default_headers(headers)
            .user_agent("cssos-rust-api/phase2-openai-chat")
            .build()?;
        Ok(Self { http, endpoint })
    }

    pub async fn generate(&self, req: &ChatRequest) -> Result<ChatResult, LlmError> {
        let mut messages = Vec::<Value>::new();
        if let Some(sys) = req.system.as_deref() {
            if !sys.is_empty() {
                messages.push(json!({"role": "system", "content": sys}));
            }
        }
        messages.push(json!({"role": "user", "content": req.user.clone()}));

        let mut payload = json!({
            "model": req.model,
            "messages": messages,
            "max_tokens": req.max_tokens,
        });
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

        let text = v
            .get("choices")
            .and_then(Value::as_array)
            .and_then(|arr| arr.first())
            .and_then(|c| c.get("message"))
            .and_then(|m| m.get("content"))
            .and_then(Value::as_str)
            .map(|s| s.to_string())
            .ok_or(LlmError::MissingField("choices[0].message.content"))?;
        let input_tokens = v
            .get("usage")
            .and_then(|u| u.get("prompt_tokens"))
            .and_then(Value::as_u64)
            .map(|n| n as u32);
        let output_tokens = v
            .get("usage")
            .and_then(|u| u.get("completion_tokens"))
            .and_then(Value::as_u64)
            .map(|n| n as u32);

        Ok(ChatResult {
            text,
            model: req.model.clone(),
            provider: "openai".to_string(),
            input_tokens,
            output_tokens,
            raw: v,
        })
    }
}
