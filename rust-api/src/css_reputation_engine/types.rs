use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReputationLevel {
    Trusted,
    Normal,
    Watchlisted,
    Restricted,
    Suspended,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReputationViolationKind {
    SelfBidding,
    SelfAutoBidding,
    SuspiciousPriceManipulation,
    AuctionDisruption,
    OwnershipAbuse,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReputationPenaltyKind {
    WarningOnly,
    DisableOwnAuctionCreation,
    DisableAuctionParticipation,
    DisableAutoBid,
    FreezeHighValueTrading,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationPenalty {
    pub kind: ReputationPenaltyKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub starts_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ends_at: Option<String>,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssReputationProfile {
    pub user_id: String,
    pub score: i32,
    pub level: ReputationLevel,
    #[serde(default)]
    pub penalties: Vec<ReputationPenalty>,
    #[serde(default)]
    pub violation_count: i32,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationEvent {
    pub event_id: String,
    pub user_id: String,
    pub violation_kind: ReputationViolationKind,
    pub message: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReputationDecision {
    pub allowed: bool,
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub level: Option<ReputationLevel>,
}
