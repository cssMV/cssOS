use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DisputeKind {
    SelfBidding,
    SelfAutoBidding,
    AuctionFinalizationConflict,
    BidOrderConflict,
    OwnershipTransferConflict,
    EntitlementConflict,
    SuspiciousPriceManipulation,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DisputeSeverity {
    Info,
    Warning,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DisputeStatus {
    Open,
    Frozen,
    Resolved,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CssDisputeCase {
    pub dispute_id: String,
    pub kind: DisputeKind,
    pub severity: DisputeSeverity,
    pub status: DisputeStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub catalog_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ownership_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deal_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    pub message: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DisputeDecision {
    pub allowed: bool,
    pub code: String,
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dispute_kind: Option<DisputeKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub severity: Option<DisputeSeverity>,
}
