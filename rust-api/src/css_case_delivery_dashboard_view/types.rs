use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDashboardMetricCard {
    pub key: String,
    pub title: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDashboardInboxPreview {
    pub key: String,
    pub title: String,
    pub count: usize,
    #[serde(default)]
    pub items: Vec<crate::css_case_delivery_query_engine::types::DeliveryQueryResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryDashboardCardKind {
    NeedsAttention,
    Escalated,
    UnderManualIntervention,
    RecentRetry,
    RecentResolutionChange,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDashboardCard {
    pub kind: DeliveryDashboardCardKind,
    pub title: String,
    pub count: usize,
    #[serde(default)]
    pub preview_subject_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryDashboardView {
    pub summary: String,
    #[serde(default)]
    pub metrics: Vec<DeliveryDashboardMetricCard>,
    #[serde(default)]
    pub inbox_previews: Vec<DeliveryDashboardInboxPreview>,
    #[serde(default)]
    pub cards: Vec<DeliveryDashboardCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDashboardRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
}
