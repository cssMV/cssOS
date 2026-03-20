use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryOpsHealthStatus {
    Healthy,
    Degraded,
    Blocked,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryOpsHealthReason {
    pub label: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryOpsHealthReport {
    pub title: String,
    pub summary: String,
    pub status: DeliveryOpsHealthStatus,
    pub checked_at: String,
    pub api_status: String,
    pub subscription_count: usize,
    pub active_subscription_count: usize,
    pub queue_count: usize,
    pub alert_count: usize,
    pub pending_recovery_count: usize,
    pub still_failing_count: usize,
    pub recent_failed_log_count: usize,
    #[serde(default)]
    pub reasons: Vec<DeliveryOpsHealthReason>,
    #[serde(default)]
    pub suggested_actions: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeliveryOpsHealthRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovery_limit: Option<usize>,
}
