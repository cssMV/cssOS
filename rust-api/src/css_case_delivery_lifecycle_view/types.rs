use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryLifecycleStage {
    Observed,
    ActiveHandling,
    Escalated,
    ManualIntervention,
    Stabilized,
    Resolved,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryLifecycleStageNode {
    pub stage: DeliveryLifecycleStage,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entered_at: Option<String>,
    pub summary: String,

    // Legacy-kept compatibility fields for older callers.
    pub kind: DeliveryLifecycleStageKind,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub started_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryLifecycleView {
    pub current_stage: DeliveryLifecycleStage,
    pub summary: String,
    #[serde(default)]
    pub stages: Vec<DeliveryLifecycleStageNode>,

    // Legacy-kept compatibility field for older callers.
    pub current_status: crate::css_case_delivery_status_view::types::CssCaseDeliveryStatusView,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryLifecycleViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

// Legacy-kept request and stage kind for older callers.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryLifecycleStageKind {
    Initial,
    Monitoring,
    Escalated,
    UnderManualIntervention,
    Stabilized,
    Resolved,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryLifecycleLegacyRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub consecutive_failures: usize,
    pub retry_still_failing: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub replay_limit: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action_limit: Option<usize>,
}
