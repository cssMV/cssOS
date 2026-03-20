use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryAnalyticsInsight {
    pub key: String,
    pub title: String,
    pub summary: String,
    #[serde(default)]
    pub details: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryAnalyticsView {
    pub summary: String,
    #[serde(default)]
    pub insights: Vec<DeliveryAnalyticsInsight>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryAnalyticsViewRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}
