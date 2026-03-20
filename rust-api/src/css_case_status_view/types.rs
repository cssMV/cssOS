use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseStatusSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseStatusKind {
    Open,
    Resolved,
    Dismissed,
    Released,
    EscalatedToManual,
    FrozenUntilReview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseStatusView {
    pub case_id: String,
    pub subject_kind: CaseStatusSubjectKind,
    pub subject_id: String,
    pub status: CaseStatusKind,
    pub label: String,
    pub is_closed_like: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseStatusRequest {
    pub case_id: String,
    pub subject_kind: CaseStatusSubjectKind,
    pub subject_id: String,
}
