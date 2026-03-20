use crate::css_catalog_engine::types::ListingMode;
use crate::css_market_view_engine::types::{BidInputAdjustment, MarketActionState};

pub fn auto_adjust_bid_to_min_valid(
    current_price_cents: i64,
    min_increment_cents: i64,
    user_bid_cents: i64,
) -> BidInputAdjustment {
    let min_valid = current_price_cents + min_increment_cents;

    if user_bid_cents < min_valid {
        return BidInputAdjustment {
            original_bid_cents: user_bid_cents,
            adjusted_bid_cents: min_valid,
            auto_adjusted: true,
            message: format!("系统已自动将您的出价调整为当前最低有效出价 {}", min_valid),
        };
    }

    BidInputAdjustment {
        original_bid_cents: user_bid_cents,
        adjusted_bid_cents: user_bid_cents,
        auto_adjusted: false,
        message: "当前出价已满足最低有效要求。".into(),
    }
}

pub fn preview_action_state() -> MarketActionState {
    MarketActionState::Enabled
}

pub fn bid_action_state(sale_mode: &ListingMode, finalized: bool) -> MarketActionState {
    if finalized {
        return MarketActionState::Disabled;
    }

    match sale_mode {
        ListingMode::TimedAuction => MarketActionState::Enabled,
        _ => MarketActionState::Hidden,
    }
}

pub fn buyout_action_state(priceless: bool, sale_mode: &ListingMode) -> MarketActionState {
    if priceless {
        return MarketActionState::Disabled;
    }

    match sale_mode {
        ListingMode::FixedPrice | ListingMode::NegotiatedDeal => MarketActionState::Enabled,
        ListingMode::TimedAuction => MarketActionState::Hidden,
    }
}

#[cfg(test)]
mod tests {
    use crate::css_catalog_engine::types::ListingMode;
    use crate::css_market_view_engine::policy::{
        auto_adjust_bid_to_min_valid, bid_action_state, buyout_action_state,
    };
    use crate::css_market_view_engine::types::MarketActionState;

    #[test]
    fn v162_low_bid_is_auto_adjusted_to_minimum_valid_step() {
        let adjusted = auto_adjust_bid_to_min_valid(100, 5, 104);
        assert!(adjusted.auto_adjusted);
        assert_eq!(adjusted.adjusted_bid_cents, 105);

        let exact = auto_adjust_bid_to_min_valid(100, 5, 105);
        assert!(!exact.auto_adjusted);
        assert_eq!(exact.adjusted_bid_cents, 105);
    }

    #[test]
    fn v162_market_action_states_follow_sale_mode_and_priceless_rules() {
        assert_eq!(
            bid_action_state(&ListingMode::TimedAuction, false),
            MarketActionState::Enabled
        );
        assert_eq!(
            bid_action_state(&ListingMode::TimedAuction, true),
            MarketActionState::Disabled
        );
        assert_eq!(
            buyout_action_state(false, &ListingMode::NegotiatedDeal),
            MarketActionState::Enabled
        );
        assert_eq!(
            buyout_action_state(true, &ListingMode::FixedPrice),
            MarketActionState::Disabled
        );
        assert_eq!(
            buyout_action_state(false, &ListingMode::TimedAuction),
            MarketActionState::Hidden
        );
    }
}
