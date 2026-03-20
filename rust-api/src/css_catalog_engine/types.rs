use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CatalogAssetVariant {
    pub variant_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ListingMode {
    FixedPrice,
    NegotiatedDeal,
    TimedAuction,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AuctionIncrementRule {
    pub after_bid_count: i32,
    pub min_increment_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AuctionPolicy {
    pub start_price_cents: i64,
    pub currency: String,
    pub start_at: String,
    pub end_at: String,
    #[serde(default)]
    pub increment_rules: Vec<AuctionIncrementRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FixedPricePolicy {
    pub price_cents: i64,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CatalogSalePolicy {
    pub mode: ListingMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fixed_price: Option<FixedPricePolicy>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub auction: Option<AuctionPolicy>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CatalogEntry {
    pub catalog_id: String,
    pub run_id: String,
    pub title: String,
    pub owner_user_id: String,
    pub scope: crate::css_ownership_engine::types::OwnershipScope,
    #[serde(default)]
    pub priceless: bool,
    #[serde(default)]
    pub variants: Vec<CatalogAssetVariant>,
    pub sale_policy: CatalogSalePolicy,
    pub created_at: String,
}
