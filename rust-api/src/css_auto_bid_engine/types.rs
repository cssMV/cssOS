use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AutoBidStatus {
    Active,
    Exhausted,
    Cancelled,
    Won,
    Lost,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CssAutoBidConfig {
    pub auto_bid_id: String,
    pub catalog_id: String,
    pub bidder_user_id: String,
    pub max_bid_cents: i64,
    pub currency: String,
    pub status: AutoBidStatus,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AutoBidDecision {
    pub should_bid: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub next_bid_cents: Option<i64>,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AutoBidResolution {
    #[serde(default)]
    pub placed_bid: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bid_price_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub leader_user_id: Option<String>,
    pub code: String,
    pub message: String,
}
