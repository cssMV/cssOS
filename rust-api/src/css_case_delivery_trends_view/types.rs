use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTrendPoint {
    pub day: String,
    pub value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTrendSeries {
    pub key: String,
    pub title: String,
    pub label: String,
    #[serde(default)]
    pub points: Vec<DeliveryTrendPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryTrendsView {
    pub summary: String,
    #[serde(default)]
    pub series: Vec<DeliveryTrendSeries>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTrendsViewRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
}
