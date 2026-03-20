use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryActionLogRecord {
    pub action_log_id: String,
    pub action: crate::css_case_delivery_actions_engine::types::DeliveryActionKind,
    pub action_target: crate::css_case_delivery_actions_engine::types::DeliveryActionTarget,
    pub succeeded: bool,
    pub message: String,
    pub created_at: String,

    // Legacy-kept compatibility fields for older callers.
    pub actor_user_id: String,
    pub reason: String,
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub subject_key: String,
    pub success: bool,
    pub result_message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
}

pub type DeliveryActionLogRecord = CssCaseDeliveryActionLogRecord;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDeliveryActionLogRequest {
    pub action: crate::css_case_delivery_actions_engine::types::DeliveryActionKind,
    pub action_target: crate::css_case_delivery_actions_engine::types::DeliveryActionTarget,
    pub succeeded: bool,
    pub message: String,

    // Legacy-kept compatibility fields for older callers.
    pub actor_user_id: String,
    pub reason: String,
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    pub subject_key: String,
    pub success: bool,
    pub result_message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryActionLogQueryRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<crate::css_case_delivery_api::types::DeliveryApiTarget>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<crate::css_case_delivery_actions_engine::types::DeliveryActionKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub succeeded: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,

    // Legacy-kept compatibility fields for older callers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
}
