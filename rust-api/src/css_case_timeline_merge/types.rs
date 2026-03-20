use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseTimelineSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseTimelineItemKind {
    GovernanceEvent,
    SignalFrame,
    StoryCard,
    CurrentState,
    CaseAction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseTimelineTone {
    Neutral,
    Info,
    Warning,
    Danger,
    Recovery,
    Positive,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseTimelineItem {
    pub item_id: String,
    pub kind: CaseTimelineItemKind,
    pub tone: CaseTimelineTone,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    pub title: String,
    pub subtitle: String,
    pub body: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_system: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseTimelineView {
    pub subject_kind: CaseTimelineSubjectKind,
    pub subject_id: String,
    #[serde(default)]
    pub items: Vec<CssCaseTimelineItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseTimelineRequest {
    pub case_id: String,
    pub subject_kind: CaseTimelineSubjectKind,
    pub subject_id: String,
}
