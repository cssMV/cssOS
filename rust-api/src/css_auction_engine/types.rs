use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuctionBidStatus {
    Accepted,
    Rejected,
    Outbid,
    Winning,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AuctionBid {
    pub bid_id: String,
    pub catalog_id: String,
    pub bidder_user_id: String,
    pub bid_price_cents: i64,
    pub currency: String,
    pub status: AuctionBidStatus,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AuctionDecisionResult {
    pub allowed: bool,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AuctionWinner {
    pub catalog_id: String,
    pub bidder_user_id: String,
    pub winning_price_cents: i64,
    pub currency: String,
    pub locked_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AuctionFinalizeResult {
    pub locked: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub winner: Option<AuctionWinner>,
    pub code: String,
    pub message: String,
}
