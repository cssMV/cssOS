use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineRequest {
    pub name: String,
    pub version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum InputRequest {
    Click,
    Text { text: String },
    Voice { voice_url: String },
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CreativeRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub style: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mood: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub tempo: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct VersionsRequest {
    #[serde(default)]
    pub langs: Vec<String>,
    #[serde(default)]
    pub voices: Vec<String>,
    #[serde(default)]
    pub outputs: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary_lang: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary_voice: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMvApiRequest {
    pub engine: EngineRequest,
    pub input: InputRequest,
    #[serde(default)]
    pub creative: CreativeRequest,
    #[serde(default)]
    pub versions: VersionsRequest,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMvApiResponse {
    pub run_id: String,
    pub engine: EngineRequest,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing: Option<crate::billing_matrix::BillingEstimate>,
}
