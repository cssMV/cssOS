use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum QaSeverity {
    Info,
    Warning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum QaCode {
    CharacterMotivationBreak,
    RelationshipContradiction,
    EmotionJumpTooLarge,
    MemoryContradiction,
    SceneSemanticMismatch,
    EndingInsufficientSetup,
    BranchWithoutTrigger,
    DialogueOutOfCharacter,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QaIssue {
    pub code: QaCode,
    pub severity: QaSeverity,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scene_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_index: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct NarrativeQaReport {
    pub passed: bool,
    #[serde(default)]
    pub issues: Vec<QaIssue>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct NarrativeQaRequest {
    pub run_id: String,
}
