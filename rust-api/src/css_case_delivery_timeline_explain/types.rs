use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryTimelineExplainedImportance {
    Decisive,
    TurningPoint,
    Informational,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTimelineExplainedNode {
    pub title: String,
    pub body: String,
    pub created_at: String,
    pub source: crate::css_case_delivery_timeline_merge::types::DeliveryTimelineMergedSource,
    pub importance: DeliveryTimelineExplainedImportance,
    pub explanation: String,

    // Legacy-kept compatibility fields for older callers.
    pub node_id: String,
    pub timestamp: String,
    pub role: DeliveryTimelineExplainNodeRole,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryTimelineExplain {
    pub summary: String,
    #[serde(default)]
    pub key_nodes: Vec<DeliveryTimelineExplainedNode>,

    // Legacy-kept compatibility fields for older callers.
    pub subject_key: String,
    #[serde(default)]
    pub explained_nodes: Vec<DeliveryTimelineExplainedNode>,
    #[serde(default)]
    pub key_findings: Vec<String>,
}

pub type CssCaseDeliveryTimelineExplainView = CssCaseDeliveryTimelineExplain;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTimelineExplainViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTimelineExplainRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryTimelineExplainNodeRole {
    Informational,
    KeyTurningPoint,
    Decisive,
}
