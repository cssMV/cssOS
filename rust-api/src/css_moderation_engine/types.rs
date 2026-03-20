use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModerationSubjectKind {
    User,
    CatalogItem,
    Auction,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModerationLevel {
    Clean,
    Observe,
    Restricted,
    Frozen,
    ReviewRequired,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ModerationAction {
    None,
    Warn,
    ObserveOnly,
    RestrictAuctionCreation,
    RestrictAuctionParticipation,
    RestrictOwnershipTransfer,
    FreezeAuction,
    FreezeDeal,
    RequireManualReview,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssModerationCase {
    pub moderation_id: String,
    pub subject_kind: ModerationSubjectKind,
    pub subject_id: String,
    pub level: ModerationLevel,
    pub action: ModerationAction,
    pub reason: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModerationDecision {
    pub allowed: bool,
    pub level: ModerationLevel,
    pub action: ModerationAction,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ModerationContext {
    #[serde(default)]
    pub open_dispute_count: i32,
    #[serde(default)]
    pub reputation_score: i32,
    #[serde(default)]
    pub reputation_violation_count: i32,
    #[serde(default)]
    pub has_active_penalty: bool,
}
