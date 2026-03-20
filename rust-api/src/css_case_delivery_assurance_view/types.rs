use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryMonitoringLevel {
    None,
    Standard,
    Heightened,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryAssuranceLevel {
    Standard,
    Protected,
    Watched,
    Intervention,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryAssuranceView {
    pub assurance_level: DeliveryAssuranceLevel,
    pub is_protected: bool,
    pub is_under_watch: bool,
    pub monitoring_level: DeliveryMonitoringLevel,
    pub requires_manual_intervention: bool,
    pub is_in_mandatory_recovery_queue: bool,
    pub is_must_deliver_protected: bool,
    pub has_governance_protection: bool,
    pub summary: String,
    #[serde(default)]
    pub protections: Vec<String>,
    #[serde(default)]
    pub limitations: Vec<String>,
    #[serde(default)]
    pub measures: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryAssuranceViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryAssuranceRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub consecutive_failures: Option<usize>,
    #[serde(default)]
    pub retry_still_failing: bool,
}
