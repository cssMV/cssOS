use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseTimelineExplainSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TimelineKeyNodeKind {
    TurningPoint,
    HumanIntervention,
    OutcomeChangingNode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineKeyNode {
    pub item_id: String,
    pub kind: TimelineKeyNodeKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    pub title: String,
    pub explanation: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_system: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseTimelineExplainView {
    pub subject_kind: CaseTimelineExplainSubjectKind,
    pub subject_id: String,
    pub summary: String,
    #[serde(default)]
    pub key_nodes: Vec<TimelineKeyNode>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseTimelineExplainRequest {
    pub case_id: String,
    pub subject_kind: CaseTimelineExplainSubjectKind,
    pub subject_id: String,
}
