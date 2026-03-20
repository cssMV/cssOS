use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseActionSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseActionKind {
    Approve,
    Reject,
    Freeze,
    Escalate,
    Release,
    RequireReview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseActionRequest {
    pub case_id: String,
    pub subject_kind: CaseActionSubjectKind,
    pub subject_id: String,
    pub action: CaseActionKind,
    pub actor_user_id: String,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseActionResult {
    pub case_id: String,
    pub subject_kind: CaseActionSubjectKind,
    pub subject_id: String,
    pub action: CaseActionKind,
    pub accepted: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseActionRecord {
    pub action_id: String,
    pub case_id: String,
    pub subject_kind: CaseActionSubjectKind,
    pub subject_id: String,
    pub action: CaseActionKind,
    pub actor_user_id: String,
    pub reason: String,
    pub accepted: bool,
    pub message: String,
    pub created_at: String,
}
