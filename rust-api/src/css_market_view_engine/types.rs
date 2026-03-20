use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MarketActionState {
    Hidden,
    Disabled,
    Enabled,
    AlreadyOwned,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BidAssistView {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_price_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_increment_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub min_valid_next_bid_cents: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BidInputAdjustment {
    pub original_bid_cents: i64,
    pub adjusted_bid_cents: i64,
    pub auto_adjusted: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MarketViewActions {
    pub preview: MarketActionState,
    pub listen: MarketActionState,
    pub bid: MarketActionState,
    pub buyout: MarketActionState,
    pub download: MarketActionState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MarketViewHeader {
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_user_id: Option<String>,
    pub sale_mode: String,
    #[serde(default)]
    pub priceless: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AuctionViewState {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_leader_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_price_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ends_at: Option<String>,
    #[serde(default)]
    pub bid_count: i32,
    #[serde(default)]
    pub finalized: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CssMarketView {
    pub header: MarketViewHeader,
    #[serde(default)]
    pub preview_seconds: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auction: Option<AuctionViewState>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub bid_assist: Option<BidAssistView>,
    pub actions: MarketViewActions,
    #[serde(default)]
    pub hints: Vec<String>,
}
