use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TimelineUiSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TimelineUiItemKind {
    GovernanceEvent,
    SignalFrame,
    StoryCard,
    CurrentState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TimelineUiTone {
    Neutral,
    Info,
    Warning,
    Danger,
    Recovery,
    Positive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineUiItem {
    pub item_id: String,
    pub kind: TimelineUiItemKind,
    pub tone: TimelineUiTone,
    pub title: String,
    pub subtitle: String,
    pub body: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_system: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssTimelineUiModel {
    pub subject_kind: TimelineUiSubjectKind,
    pub subject_id: String,
    #[serde(default)]
    pub items: Vec<TimelineUiItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineUiRequest {
    pub subject_kind: TimelineUiSubjectKind,
    pub subject_id: String,
}
