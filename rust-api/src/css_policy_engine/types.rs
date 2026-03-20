use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommercePolicy {
    pub preview_seconds: u32,
    pub priceless_blocks_buyout: bool,
    pub high_value_trade_cents: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RightsPolicy {
    pub trilogy_requires_whole_buyout: bool,
    pub opera_requires_whole_buyout: bool,
    pub language_variant_buyout_allowed: bool,
    pub listen_rights_survive_ownership_transfer: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuctionPolicyConfig {
    pub seller_can_choose_buyer_in_negotiated_deal: bool,
    pub seller_can_choose_buyer_in_timed_auction: bool,
    pub self_bidding_forbidden: bool,
    pub self_auto_bid_forbidden: bool,
    pub invalid_bid_auto_adjust_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreditPolicy {
    pub initial_score: i32,
    pub low_warning_threshold: i32,
    pub high_risk_threshold: i32,
    pub restrict_threshold: i32,
    pub self_bidding_penalty: i32,
    pub self_auto_bid_penalty: i32,
    pub suspicious_price_manipulation_penalty: i32,
    pub auction_disruption_penalty: i32,
    pub listen_sale_reward: i32,
    pub buyout_sale_reward: i32,
    pub successful_auction_reward: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernancePolicy {
    pub review_required_for_high_value_trade: bool,
    pub critical_dispute_freezes_action: bool,
    pub active_penalty_restricts_auction_participation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssPolicyBundle {
    pub commerce: CommercePolicy,
    pub rights: RightsPolicy,
    pub auction: AuctionPolicyConfig,
    pub credit: CreditPolicy,
    pub governance: GovernancePolicy,
}
