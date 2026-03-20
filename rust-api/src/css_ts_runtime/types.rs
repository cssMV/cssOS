use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TsActionKind {
    CreateAuction,
    ParticipateAuction,
    EnableAutoBid,
    SubmitBid,
    CreateDealIntent,
    FinalizeDeal,
    TransferOwnership,
    HighValueTrade,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TsSubjectKind {
    User,
    Catalog,
    Auction,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TsDecisionKind {
    Allow,
    Restrict,
    Freeze,
    ReviewRequired,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TsRuntimeRequest {
    pub action: TsActionKind,
    pub actor_user_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_kind: Option<TsSubjectKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub catalog_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ownership_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deal_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub amount_cents: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TsRuntimeDecision {
    pub decision: TsDecisionKind,
    pub code: String,
    pub message: String,
    #[serde(default)]
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TsRuntimeContext {
    #[serde(default)]
    pub reputation_score: i32,
    #[serde(default)]
    pub violation_count: i32,
    #[serde(default)]
    pub open_dispute_count: i32,
    #[serde(default)]
    pub has_active_penalty: bool,
    #[serde(default)]
    pub moderation_level: String,
    #[serde(default)]
    pub moderation_action: String,
}
