use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TimelineSubjectKind {
    User,
    Catalog,
    Auction,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TimelineEventKind {
    DisputeOpened,
    DisputeResolved,
    ReputationViolationApplied,
    ReputationPenaltyApplied,
    ModerationCaseOpened,
    ModerationRestrictionApplied,
    TsDecisionRecorded,
    ReviewOpened,
    ReviewAssigned,
    ReviewApproved,
    ReviewRejected,
    ReviewEscalated,
    AuctionFrozen,
    AuctionUnfrozen,
    DealFrozen,
    DealReleased,
    PolicyMigrationPlanned,
    PolicyMigrationApplied,
    PolicyMigrationRejected,
    CreditScoreInitialized,
    CreditScoreIncreased,
    CreditScoreDecreased,
    CreditWarningTriggered,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceTimelineEntry {
    pub timeline_id: String,
    pub subject_kind: TimelineSubjectKind,
    pub subject_id: String,
    pub event_kind: TimelineEventKind,
    pub source_system: String,
    pub source_id: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit_score_before: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit_score_after: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit_delta: Option<i32>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimelineAppendRequest {
    pub subject_kind: TimelineSubjectKind,
    pub subject_id: String,
    pub event_kind: TimelineEventKind,
    pub source_system: String,
    pub source_id: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit_score_before: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit_score_after: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub credit_delta: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCreditProfile {
    pub user_id: String,
    pub score: i32,
    pub updated_at: String,
}
