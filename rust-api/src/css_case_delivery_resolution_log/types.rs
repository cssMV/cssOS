use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryResolutionTriggerKind {
    ActionDriven,
    TimelineDriven,
    PolicyDriven,
    ManualDecision,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryResolutionLogRecord {
    pub resolution_log_id: String,
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub state: crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trigger_kind: Option<DeliveryResolutionTriggerKind>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trigger_ref: Option<String>,

    #[serde(default)]
    pub reasons: Vec<String>,
    pub created_at: String,
}

pub type DeliveryResolutionLogRecord = CssCaseDeliveryResolutionLogRecord;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDeliveryResolutionLogRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub state: crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trigger_kind: Option<DeliveryResolutionTriggerKind>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub trigger_ref: Option<String>,

    #[serde(default)]
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryResolutionLogQueryRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<crate::css_case_delivery_log::types::CaseDeliveryLogTarget>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<crate::css_case_delivery_log::types::CaseDeliveryLogMode>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub state: Option<crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}
