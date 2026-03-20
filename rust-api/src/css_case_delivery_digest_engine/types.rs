use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDigestDailyMetrics {
    pub escalated_count: usize,
    pub manual_intervention_count: usize,
    pub retry_count: usize,
    pub resolution_change_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDigestInboxCount {
    pub key: String,
    pub title: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryDigestSection {
    pub title: String,

    #[serde(default)]
    pub lines: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryDigest {
    pub title: String,
    pub summary: String,

    pub daily_metrics: DeliveryDigestDailyMetrics,

    #[serde(default)]
    pub inbox_counts: Vec<DeliveryDigestInboxCount>,

    #[serde(default)]
    pub alert_titles: Vec<String>,

    #[serde(default)]
    pub highlights: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeliveryDigestRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub days: Option<usize>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preview_limit: Option<usize>,
}
