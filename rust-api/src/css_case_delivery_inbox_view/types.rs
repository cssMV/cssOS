use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryInboxKind {
    NeedsAttention,
    Escalated,
    UnderManualIntervention,
    RecentRetry,
    RecentResolutionChange,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryInboxSection {
    pub kind: DeliveryInboxKind,
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub items: Vec<crate::css_case_delivery_query_engine::types::DeliveryQueryResultItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryInboxView {
    #[serde(default)]
    pub sections: Vec<DeliveryInboxSection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryInboxViewRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub section_limit: Option<usize>,
}
