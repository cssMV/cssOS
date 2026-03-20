use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryExplainApiFields {
    pub policy_version_label: String,
    pub severity: String,
    pub escalate: bool,
    pub require_manual_intervention: bool,
    pub must_deliver: bool,
    pub no_silent_failure: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryExplainSummary {
    pub title: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryExplainFields {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy_version: Option<String>,
    pub must_deliver: bool,
    pub silent_failure_allowed: bool,
    pub should_escalate: bool,
    pub require_manual_intervention: bool,
    pub consecutive_failures: usize,
    pub retry_still_failing: bool,
    #[serde(default)]
    pub decisive_rules: Vec<String>,

    // Legacy-kept compatibility fields for older trust/risk/signals callers.
    pub policy_id: String,
    pub decision: String,
    pub severity: String,
    pub action: String,
    pub target: String,
    pub mode: String,
    pub failure_streak: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub decisive_rule: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryExplainView {
    pub ops_explanation: String,
    pub management_summary: String,
    pub api_fields: DeliveryExplainApiFields,
    #[serde(default)]
    pub highlights: Vec<String>,

    // Legacy-kept compatibility fields for older callers.
    pub ops_summary: String,
    #[serde(default)]
    pub reasons: Vec<String>,
    pub fields: DeliveryExplainFields,
    pub summary: DeliveryExplainSummary,
    #[serde(default)]
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryExplainViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryExplainRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consecutive_failures: Option<usize>,
    #[serde(default)]
    pub retry_still_failing: bool,
}
