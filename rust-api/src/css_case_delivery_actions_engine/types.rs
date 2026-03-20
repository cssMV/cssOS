use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryActionKind {
    Retry,
    ForceRefreshSignals,
    CaptureSnapshot,
    EscalateOps,
    RequireManualIntervention,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryActionTarget {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryActionRequest {
    pub action: DeliveryActionKind,
    pub actor_user_id: String,
    pub reason: String,
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub delivered: bool,
    pub failure_streak: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryActionResult {
    pub action: DeliveryActionKind,
    pub succeeded: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryActionResult {
    pub action: DeliveryActionKind,
    pub success: bool,
    pub message: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_key: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_name: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
}
