use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReviewSubjectKind {
    User,
    Catalog,
    Auction,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReviewPriority {
    Low,
    Normal,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReviewStatus {
    Open,
    Assigned,
    InReview,
    Approved,
    Rejected,
    Escalated,
    Closed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReviewDecisionKind {
    Approve,
    Reject,
    Freeze,
    Escalate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssReviewItem {
    pub review_id: String,
    pub subject_kind: ReviewSubjectKind,
    pub subject_id: String,
    pub priority: ReviewPriority,
    pub status: ReviewStatus,
    pub source_action: String,
    pub source_code: String,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assigned_reviewer_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewDecision {
    pub review_id: String,
    pub decision: ReviewDecisionKind,
    pub comment: String,
    pub reviewer_user_id: String,
    pub decided_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReviewOpenRequest {
    pub subject_kind: ReviewSubjectKind,
    pub subject_id: String,
    pub source_action: String,
    pub source_code: String,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
    pub priority: ReviewPriority,
}
