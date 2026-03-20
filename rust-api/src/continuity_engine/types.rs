use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContinuitySeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ContinuityCode {
    TimeJumpUnexplained,
    LocationJumpUnexplained,
    CharacterPositionMismatch,
    ObjectStateMismatch,
    CameraAxisBreak,
    SceneTransitionGap,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ContinuityIssue {
    pub code: ContinuityCode,
    pub severity: ContinuitySeverity,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scene_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_index: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct ContinuityReport {
    pub passed: bool,
    #[serde(default)]
    pub issues: Vec<ContinuityIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ContinuityRequest {
    pub run_id: String,
}
