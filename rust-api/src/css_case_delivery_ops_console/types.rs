use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryOpsConsoleStatusItem {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subscription_id: Option<String>,
    pub summary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryOpsConsoleActionItem {
    pub action_key: String,
    pub title: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryOpsConsole {
    pub dashboard: crate::css_case_delivery_dashboard_view::types::CssCaseDeliveryDashboardView,
    pub alerts: crate::css_case_delivery_alerts_view::types::CssCaseDeliveryAlertsView,
    pub recovery: crate::css_case_delivery_recovery_view::types::CssCaseDeliveryRecoveryView,
    #[serde(default)]
    pub recent_status_items: Vec<DeliveryOpsConsoleStatusItem>,
    #[serde(default)]
    pub actions: Vec<DeliveryOpsConsoleActionItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryOpsConsoleRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub recovery_limit: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
}
