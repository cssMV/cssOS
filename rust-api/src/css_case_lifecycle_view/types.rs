use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseLifecycleSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseLifecycleStageKind {
    Open,
    UnderReview,
    Escalated,
    Frozen,
    Released,
    Resolved,
    Dismissed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseLifecycleStage {
    pub stage_kind: CaseLifecycleStageKind,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub entered_at: Option<String>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseLifecycleView {
    pub case_id: String,
    pub subject_kind: CaseLifecycleSubjectKind,
    pub subject_id: String,
    #[serde(default)]
    pub stages: Vec<CaseLifecycleStage>,
    pub current_stage: CaseLifecycleStageKind,
    pub current_label: String,
    pub is_closed_like: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseLifecycleRequest {
    pub case_id: String,
    pub subject_kind: CaseLifecycleSubjectKind,
    pub subject_id: String,
}
