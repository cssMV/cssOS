use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryResolutionState {
    Resolved,
    Stabilized,
    Escalated,
    UnderManualIntervention,
    MonitoringOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryResolution {
    pub resolution_state: DeliveryResolutionState,
    pub summary: String,
    #[serde(default)]
    pub reasons: Vec<String>,

    // Legacy-kept compatibility field for older callers.
    pub state: DeliveryResolutionState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryResolutionViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryResolutionRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
}
