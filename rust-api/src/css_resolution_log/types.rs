use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResolutionLogSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResolutionLogDecisionKind {
    Resolve,
    Dismiss,
    Release,
    EscalateToManual,
    FreezeUntilReview,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResolutionLogStatus {
    Open,
    Resolved,
    Dismissed,
    Released,
    EscalatedToManual,
    FrozenUntilReview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssResolutionLogRecord {
    pub log_id: String,
    pub resolution_id: String,
    pub case_id: String,
    pub subject_kind: ResolutionLogSubjectKind,
    pub subject_id: String,
    pub decision: ResolutionLogDecisionKind,
    pub status: ResolutionLogStatus,
    pub actor_user_id: String,
    pub reason: String,
    pub is_closed_like: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionLogCreateRequest {
    pub resolution_id: String,
    pub case_id: String,
    pub subject_kind: ResolutionLogSubjectKind,
    pub subject_id: String,
    pub decision: ResolutionLogDecisionKind,
    pub status: ResolutionLogStatus,
    pub actor_user_id: String,
    pub reason: String,
    pub is_closed_like: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_id: Option<String>,
}
