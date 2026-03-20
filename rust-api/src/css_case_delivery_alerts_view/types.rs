use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryAlertSeverity {
    Warning,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryAlertItem {
    pub key: String,
    pub title: String,
    pub summary: String,
    pub severity: DeliveryAlertSeverity,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub day: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryAlertsView {
    pub summary: String,

    #[serde(default)]
    pub alerts: Vec<DeliveryAlertItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeliveryAlertsViewRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,
}

pub type DeliveryAlertsRequest = DeliveryAlertsViewRequest;
