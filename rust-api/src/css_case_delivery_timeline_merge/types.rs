use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryTimelineMergedSource {
    Signal,
    Action,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryTimelineMergedKind {
    State,
    Action,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTimelineMergedNode {
    pub source: DeliveryTimelineMergedSource,
    pub merged_kind: DeliveryTimelineMergedKind,
    pub title: String,
    pub body: String,
    pub created_at: String,
    pub is_pivot: bool,

    // Legacy-kept compatibility fields for older callers.
    pub node_id: String,
    pub kind: DeliveryMergedTimelineNodeKind,
    pub tone: DeliveryMergedTimelineNodeTone,
    pub summary: String,
    pub timestamp: String,
    #[serde(default)]
    pub badges: Vec<String>,
    pub is_turning_point: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub signal_snapshot_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action_log_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryTimelineMerge {
    pub title: String,
    pub summary: String,
    #[serde(default)]
    pub nodes: Vec<DeliveryTimelineMergedNode>,

    // Legacy-kept compatibility fields for older callers.
    pub subject_key: String,
}

pub type CssCaseDeliveryTimelineMergeView = CssCaseDeliveryTimelineMerge;
pub type DeliveryMergedTimelineNode = DeliveryTimelineMergedNode;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryMergedTimelineNodeKind {
    SignalState,
    Action,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryMergedTimelineNodeTone {
    Neutral,
    Warning,
    Critical,
    Positive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTimelineMergeViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTimelineMergeRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
}
