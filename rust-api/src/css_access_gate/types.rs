use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AccessAction {
    Preview,
    Listen,
    Stream,
    Download,
    Buyout,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AccessTarget {
    pub work_structure: crate::css_rights_engine::types::RightsWorkStructure,
    pub unit: crate::css_rights_engine::types::RightsUnit,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CssAccessRequest {
    pub user_id: String,
    pub action: AccessAction,
    pub target: AccessTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AccessDecision {
    Allow,
    AllowPreviewOnly,
    Deny,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CssAccessDecision {
    pub decision: AccessDecision,
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_seconds: Option<u32>,
}
