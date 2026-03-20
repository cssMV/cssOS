use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryStoryboardCardKind {
    Start,
    RiskEscalation,
    Recovery,
    CurrentState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryStoryboardCard {
    pub kind: DeliveryStoryboardCardKind,
    pub title: String,
    pub body: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,

    // Legacy-kept compatibility fields for older timeline/storyboard consumers.
    pub summary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    #[serde(default)]
    pub badges: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryStoryboard {
    pub title: String,
    pub summary: String,
    #[serde(default)]
    pub cards: Vec<DeliveryStoryboardCard>,

    // Legacy-kept compatibility field for older callers.
    pub subject_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryStoryboardViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryStoryboardRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}
