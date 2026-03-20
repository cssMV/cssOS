use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryKpiMetric {
    pub key: String,
    pub label: String,
    pub numerator: usize,
    pub denominator: usize,
    pub ratio: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryKpiView {
    #[serde(default)]
    pub metrics: Vec<DeliveryKpiMetric>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryKpiViewRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}
