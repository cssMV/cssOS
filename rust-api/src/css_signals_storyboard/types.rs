use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StoryboardSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StoryboardCardKind {
    InitialState,
    RiskEscalation,
    ReviewStarted,
    Restricted,
    Frozen,
    RecoveryStarted,
    StableState,
    CurrentState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum StoryboardTone {
    Neutral,
    Warning,
    Danger,
    Recovery,
    Positive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryboardCard {
    pub card_id: String,
    pub kind: StoryboardCardKind,
    pub tone: StoryboardTone,
    pub title: String,
    pub subtitle: String,
    pub body: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub snapshot_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssSignalsStoryboard {
    pub subject_kind: StoryboardSubjectKind,
    pub subject_id: String,
    #[serde(default)]
    pub cards: Vec<StoryboardCard>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryboardRequest {
    pub subject_kind: StoryboardSubjectKind,
    pub subject_id: String,
}
