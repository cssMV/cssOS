pub fn default_policy_bundle() -> crate::css_policy_engine::types::CssPolicyBundle {
    crate::css_policy_engine::types::CssPolicyBundle {
        commerce: crate::css_policy_engine::types::CommercePolicy {
            preview_seconds: 30,
            priceless_blocks_buyout: true,
            high_value_trade_cents: 100_000,
        },
        rights: crate::css_policy_engine::types::RightsPolicy {
            trilogy_requires_whole_buyout: true,
            opera_requires_whole_buyout: true,
            language_variant_buyout_allowed: true,
            listen_rights_survive_ownership_transfer: true,
        },
        auction: crate::css_policy_engine::types::AuctionPolicyConfig {
            seller_can_choose_buyer_in_negotiated_deal: true,
            seller_can_choose_buyer_in_timed_auction: false,
            self_bidding_forbidden: true,
            self_auto_bid_forbidden: true,
            invalid_bid_auto_adjust_enabled: true,
        },
        credit: crate::css_policy_engine::types::CreditPolicy {
            initial_score: 700,
            low_warning_threshold: 600,
            high_risk_threshold: 500,
            restrict_threshold: 400,
            self_bidding_penalty: -40,
            self_auto_bid_penalty: -50,
            suspicious_price_manipulation_penalty: -60,
            auction_disruption_penalty: -30,
            listen_sale_reward: 5,
            buyout_sale_reward: 15,
            successful_auction_reward: 20,
        },
        governance: crate::css_policy_engine::types::GovernancePolicy {
            review_required_for_high_value_trade: true,
            critical_dispute_freezes_action: true,
            active_penalty_restricts_auction_participation: true,
        },
    }
}
