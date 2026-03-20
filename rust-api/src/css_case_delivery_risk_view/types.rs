use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryRiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryRiskFactorKind {
    ConsecutiveFailure,
    Escalation,
    ManualInterventionRequired,
    MustDeliverViolation,
    SilentFailureNotAllowed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryRiskFactor {
    pub key: String,
    pub label: String,
    pub active: bool,
    pub detail: String,

    // Legacy-kept compatibility fields for older callers.
    pub title: String,
    pub explanation: String,
    pub kind: DeliveryRiskFactorKind,
    pub level: DeliveryRiskLevel,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryRiskView {
    pub risk_level: DeliveryRiskLevel,
    pub is_high_risk: bool,
    pub summary: String,
    #[serde(default)]
    pub factors: Vec<DeliveryRiskFactor>,

    // Legacy-kept compatibility fields for older callers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary_factor: Option<DeliveryRiskFactorKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub primary_factor_key: Option<String>,
    #[serde(default)]
    pub active_factor_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryRiskViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryRiskRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consecutive_failures: Option<usize>,
    #[serde(default)]
    pub retry_still_failing: bool,
}
