use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseDeliveryStatusKind {
    NeverDelivered,
    Delivered,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseDeliveryStatusTarget {
    Subscription,
    ExportTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseDeliveryStatusRequest {
    pub query_kind: CaseDeliveryStatusTarget,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<crate::css_case_delivery_log::types::CaseDeliveryLogTarget>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryLogStatusView {
    // Legacy-kept delivery-log status for ops/history style callers.
    pub status: CaseDeliveryStatusKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_key: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscriber_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<crate::css_case_delivery_log::types::CaseDeliveryLogTarget>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format: Option<crate::css_case_delivery_log::types::CaseDeliveryLogFormat>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<crate::css_case_delivery_log::types::CaseDeliveryLogMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryStatusView {
    pub state: crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    pub summary: String,
    #[serde(default)]
    pub reasons: Vec<String>,
}

pub type CssCaseDeliveryFormalStatusView = CssCaseDeliveryStatusView;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryStatusViewRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,

    pub consecutive_failures: usize,
    pub retry_still_failing: bool,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub replay_limit: Option<usize>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action_limit: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum DeliveryCurrentStatusLookup {
    BySubscription {
        subscription_id: String,
    },
    ByTargetMode {
        target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
        mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryCurrentStatusView {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target: Option<crate::css_case_delivery_log::types::CaseDeliveryLogTarget>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub mode: Option<crate::css_case_delivery_log::types::CaseDeliveryLogMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub api_mode: Option<crate::css_case_delivery_api::types::DeliveryApiMode>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub success: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub result_message: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payload_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryCurrentStatusRequest {
    pub lookup: DeliveryCurrentStatusLookup,
}
