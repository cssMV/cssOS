use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryTrustLevel {
    Healthy,
    Guarded,
    Risky,
    Untrusted,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryGovernanceGrade {
    Normal,
    Elevated,
    // Legacy-kept for older serialized callers; new code should use Elevated.
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryTrustView {
    pub trust_level: DeliveryTrustLevel,
    pub is_trusted: bool,
    pub is_high_attention: bool,
    pub requires_manual_intervention: bool,
    pub summary: String,
    #[serde(default)]
    pub highlights: Vec<String>,

    // Legacy-kept compatibility fields for older callers.
    pub governance_grade: DeliveryGovernanceGrade,
    pub is_consecutive_failure: bool,
    pub has_must_deliver_violation: bool,
    #[serde(default)]
    pub signals: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTrustViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTrustRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consecutive_failures: Option<usize>,
    #[serde(default)]
    pub retry_still_failing: bool,
}
