use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReasoningAudience {
    Operator,
    User,
    Api,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningReasonItem {
    pub title: String,
    pub explanation: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rule_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy_version_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningOutcomeItem {
    pub label: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReasoningActionItem {
    pub label: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssReasoningView {
    pub audience: ReasoningAudience,
    pub summary: String,
    #[serde(default)]
    pub reasons: Vec<ReasoningReasonItem>,
    #[serde(default)]
    pub outcomes: Vec<ReasoningOutcomeItem>,
    #[serde(default)]
    pub suggested_actions: Vec<ReasoningActionItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiReasoningView {
    pub code: String,
    pub summary: String,
    #[serde(default)]
    pub reason_keys: Vec<String>,
    #[serde(default)]
    pub outcome_labels: Vec<String>,
    #[serde(default)]
    pub suggested_action_labels: Vec<String>,
}
