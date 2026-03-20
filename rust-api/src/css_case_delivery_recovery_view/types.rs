use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryRecoveryState {
    PendingRecovery,
    Recovered,
    RetryStillFailing,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryRecoveryPriority {
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryRecoveryItem {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,

    pub mode: crate::css_case_delivery_api::types::DeliveryApiMode,
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub report_type: crate::css_case_delivery_report_api::types::DeliveryReportType,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub export_format: Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,

    pub state: DeliveryRecoveryState,
    pub priority: DeliveryRecoveryPriority,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest_failed_delivery_log_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest_success_delivery_log_id: Option<String>,

    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeliveryRecoverySummary {
    pub pending_recovery_count: usize,
    pub recovered_count: usize,
    pub still_failing_count: usize,
    pub high_priority_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryRecoveryView {
    #[serde(default)]
    #[serde(alias = "pending_items")]
    pub pending_recovery: Vec<DeliveryRecoveryItem>,

    #[serde(default)]
    #[serde(alias = "recovered_items")]
    pub recovered: Vec<DeliveryRecoveryItem>,

    #[serde(default)]
    #[serde(alias = "retry_failed")]
    #[serde(alias = "retry_still_failing_items")]
    pub still_failing: Vec<DeliveryRecoveryItem>,

    #[serde(default)]
    pub priority_queue: Vec<DeliveryRecoveryItem>,

    #[serde(default)]
    pub summary: DeliveryRecoverySummary,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryRecoveryViewRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}
