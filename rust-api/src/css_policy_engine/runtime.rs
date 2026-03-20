pub fn get_policy_bundle() -> crate::css_policy_engine::types::CssPolicyBundle {
    crate::css_policy_engine::defaults::default_policy_bundle()
}

pub fn preview_seconds() -> u32 {
    get_policy_bundle().commerce.preview_seconds
}

pub fn credit_initial_score() -> i32 {
    get_policy_bundle().credit.initial_score
}

pub fn credit_low_warning_threshold() -> i32 {
    get_policy_bundle().credit.low_warning_threshold
}

pub fn high_value_trade_cents() -> i64 {
    get_policy_bundle().commerce.high_value_trade_cents
}

pub fn self_bidding_forbidden() -> bool {
    get_policy_bundle().auction.self_bidding_forbidden
}

pub fn invalid_bid_auto_adjust_enabled() -> bool {
    get_policy_bundle().auction.invalid_bid_auto_adjust_enabled
}

pub fn listen_sale_reward() -> i32 {
    get_policy_bundle().credit.listen_sale_reward
}

pub fn buyout_sale_reward() -> i32 {
    get_policy_bundle().credit.buyout_sale_reward
}

pub fn successful_auction_reward() -> i32 {
    get_policy_bundle().credit.successful_auction_reward
}

pub fn self_bidding_penalty() -> i32 {
    get_policy_bundle().credit.self_bidding_penalty
}

pub fn self_auto_bid_penalty() -> i32 {
    get_policy_bundle().credit.self_auto_bid_penalty
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn v171_policy_bundle_exposes_platform_defaults() {
        assert_eq!(preview_seconds(), 30);
        assert_eq!(credit_initial_score(), 700);
        assert!(self_bidding_forbidden());
        assert!(invalid_bid_auto_adjust_enabled());
    }
}
