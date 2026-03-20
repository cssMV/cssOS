use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseActionLogSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseActionLogKind {
    Approve,
    Reject,
    Freeze,
    Escalate,
    Release,
    RequireReview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseActionLogRecord {
    pub log_id: String,
    pub case_id: String,
    pub subject_kind: CaseActionLogSubjectKind,
    pub subject_id: String,
    pub action: CaseActionLogKind,
    pub actor_user_id: String,
    pub reason: String,
    pub accepted: bool,
    pub result_message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActionLogCreateRequest {
    pub case_id: String,
    pub subject_kind: CaseActionLogSubjectKind,
    pub subject_id: String,
    pub action: CaseActionLogKind,
    pub actor_user_id: String,
    pub reason: String,
    pub accepted: bool,
    pub result_message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_id: Option<String>,
}
