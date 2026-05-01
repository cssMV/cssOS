// CSSOS_PHASE2_LLM 20260418 — LLM chat-completion adapters.
//
// Two providers live here so the frontend advanced-settings panel can offer
// both to users ("一切参数化"):
//   - OpenAI chat completions (gpt-4o-mini, gpt-4o, etc.)
//   - Anthropic messages API (claude-haiku-4-5, claude-sonnet-4-6, etc.)
//
// Both are used by `/api/mv/lyrics` — the user picks engine+version in the
// UI, the Rust route resolves the client, and the price is looked up in
// `billing_matrix::default_price_rule`.
//
// Intentionally kept tiny: one request shape, one result shape. If we ever
// need tool-calling or streaming we'll layer that on top.

pub mod anthropic;
pub mod openai;

use serde::{Deserialize, Serialize};
use thiserror::Error;

pub use anthropic::AnthropicClient;
pub use openai::OpenAiChatClient;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatRequest {
    /// Model identifier, e.g. `gpt-4o-mini`, `claude-haiku-4-5`.
    pub model: String,
    /// System prompt — role guidance, format constraints, etc.
    #[serde(default)]
    pub system: Option<String>,
    /// User turn — the actual task prompt.
    pub user: String,
    /// Max tokens for the response. Small (e.g. 1024) for lyrics.
    pub max_tokens: u32,
    /// Sampling temperature, 0.0..=2.0. None = provider default.
    #[serde(default)]
    pub temperature: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatResult {
    pub text: String,
    pub model: String,
    pub provider: String,
    pub input_tokens: Option<u32>,
    pub output_tokens: Option<u32>,
    pub raw: serde_json::Value,
}

#[derive(Debug, Error)]
pub enum LlmError {
    #[error("LLM provider not configured (missing env key)")]
    NotConfigured,
    #[error("LLM transport error: {0}")]
    Transport(#[from] reqwest::Error),
    #[error("LLM upstream returned {status}: {body}")]
    Upstream { status: u16, body: String },
    #[error("LLM response missing field: {0}")]
    MissingField(&'static str),
}

/// Resolve an engine identifier to a provider client call. Returns
/// `Err(LlmError::NotConfigured)` if the required API key env var is empty.
pub async fn generate_chat(
    engine: &str,
    req: &ChatRequest,
) -> Result<ChatResult, LlmError> {
    match engine {
        "openai" => {
            let client = OpenAiChatClient::from_env()?;
            client.generate(req).await
        }
        "anthropic" => {
            let client = AnthropicClient::from_env()?;
            client.generate(req).await
        }
        _ => Err(LlmError::Upstream {
            status: 0,
            body: format!("unknown LLM engine: {}", engine),
        }),
    }
}
