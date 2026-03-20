use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryTimelineUiNodeKind {
    Start,
    Escalation,
    Recovery,
    Current,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryTimelineNodeTone {
    Neutral,
    Warning,
    Critical,
    Positive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTimelineUiNode {
    pub kind: DeliveryTimelineUiNodeKind,
    pub title: String,
    pub body: String,
    pub status: String,
    pub is_pivot: bool,
    pub is_current: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,

    // Legacy-kept compatibility fields for older timeline consumers.
    pub node_id: String,
    pub summary: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timestamp: Option<String>,
    #[serde(default)]
    pub badges: Vec<String>,
    pub tone: DeliveryTimelineNodeTone,
    pub is_turning_point: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTimelineUiCurrentState {
    pub trust_level: String,
    pub risk_level: String,
    pub assurance_level: String,
    pub summary: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryTimelineUiModel {
    pub title: String,
    pub summary: String,
    pub current_state: DeliveryTimelineUiCurrentState,
    #[serde(default)]
    pub nodes: Vec<DeliveryTimelineUiNode>,

    // Legacy-kept compatibility fields for older callers.
    pub subject_key: String,
    pub headline: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_status_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTimelineUiViewRequest {
    pub target: crate::css_case_delivery_api::types::DeliveryApiTarget,
    pub consecutive_failures: usize,
    pub latest_failed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryTimelineUiModelRequest {
    pub target: crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    pub mode: crate::css_case_delivery_log::types::CaseDeliveryLogMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}

pub type DeliveryTimelineNode = DeliveryTimelineUiNode;
