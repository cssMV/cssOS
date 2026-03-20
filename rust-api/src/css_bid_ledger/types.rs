use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum LedgerEventKind {
    BidSubmitted,
    BidAccepted,
    BidRejected,
    BidOutbid,
    LeaderChanged,
    AuctionFinalized,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LedgerEntry {
    pub ledger_id: String,
    pub catalog_id: String,
    pub event_kind: LedgerEventKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bid_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bidder_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bid_price_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_required_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_leader_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub new_leader_user_id: Option<String>,
    pub message: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LedgerAppendRequest {
    pub catalog_id: String,
    pub event_kind: LedgerEventKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bid_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bidder_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bid_price_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_required_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous_leader_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub new_leader_user_id: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct LedgerSnapshot {
    pub catalog_id: String,
    #[serde(default)]
    pub total_entries: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_leader_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_price_cents: Option<i64>,
    #[serde(default)]
    pub finalized: bool,
}
