use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResolutionSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResolutionStatus {
    Open,
    Resolved,
    Dismissed,
    Released,
    EscalatedToManual,
    FrozenUntilReview,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ResolutionDecisionKind {
    Resolve,
    Dismiss,
    Release,
    EscalateToManual,
    FreezeUntilReview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssResolutionRecord {
    pub resolution_id: String,
    pub case_id: String,
    pub subject_kind: ResolutionSubjectKind,
    pub subject_id: String,
    pub decision: ResolutionDecisionKind,
    pub status: ResolutionStatus,
    pub actor_user_id: String,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionRequest {
    pub case_id: String,
    pub subject_kind: ResolutionSubjectKind,
    pub subject_id: String,
    pub decision: ResolutionDecisionKind,
    pub actor_user_id: String,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolutionResult {
    pub case_id: String,
    pub status: ResolutionStatus,
    pub accepted: bool,
    pub message: String,
}
