use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiffTarget {
    pub run_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BranchDiffRequest {
    pub left: DiffTarget,
    pub right: DiffTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct BranchDivergencePoint {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_index: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left_event_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub right_event_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left_story_node: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub right_story_node: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct RuntimeDiffSummary {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shared_prefix_events: Option<usize>,
    pub same_ending: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left_ending: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub right_ending: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BranchDiffResult {
    pub left: DiffTarget,
    pub right: DiffTarget,
    pub summary: RuntimeDiffSummary,
    pub divergence: BranchDivergencePoint,
    #[serde(default)]
    pub changed_fields: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EndingDiffResult {
    pub left_run_id: String,
    pub right_run_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub left_ending: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub right_ending: Option<String>,
    pub same: bool,
    #[serde(default)]
    pub changed_dimensions: Vec<String>,
}
