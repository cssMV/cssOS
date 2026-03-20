use crate::css_auction_engine::types::AuctionDecisionResult;

pub fn auction_open(
    now_rfc3339: &str,
    auction: &crate::css_catalog_engine::types::AuctionPolicy,
) -> bool {
    now_rfc3339 >= auction.start_at.as_str() && now_rfc3339 < auction.end_at.as_str()
}

pub fn current_min_increment_cents(
    auction: &crate::css_catalog_engine::types::AuctionPolicy,
    bid_count: i32,
) -> i64 {
    crate::css_catalog_engine::policy::current_min_increment(auction, bid_count)
}

pub fn validate_bid(
    auction: &crate::css_catalog_engine::types::AuctionPolicy,
    current_highest_cents: Option<i64>,
    current_bid_count: i32,
    new_bid_cents: i64,
) -> AuctionDecisionResult {
    let ok = crate::css_catalog_engine::policy::bid_valid(
        auction,
        current_highest_cents,
        current_bid_count,
        new_bid_cents,
    );
    if ok {
        AuctionDecisionResult {
            allowed: true,
            code: "bid_valid".into(),
            message: "当前出价有效。".into(),
        }
    } else {
        let min_next = match current_highest_cents {
            None => auction.start_price_cents,
            Some(highest) => highest + current_min_increment_cents(auction, current_bid_count),
        };
        AuctionDecisionResult {
            allowed: false,
            code: "bid_too_low".into(),
            message: format!("出价过低，当前最低有效出价为 {}", min_next),
        }
    }
}

pub fn should_auto_finalize(
    now_rfc3339: &str,
    auction: &crate::css_catalog_engine::types::AuctionPolicy,
    auto_locked: bool,
    current_leader_user_id: Option<&String>,
) -> bool {
    !auto_locked && now_rfc3339 >= auction.end_at.as_str() && current_leader_user_id.is_some()
}

pub fn seller_selection_disabled_in_auction() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use crate::css_auction_engine::policy::{
        auction_open, seller_selection_disabled_in_auction, should_auto_finalize, validate_bid,
    };
    use crate::css_catalog_engine::types::{AuctionIncrementRule, AuctionPolicy};

    fn auction() -> AuctionPolicy {
        AuctionPolicy {
            start_price_cents: 100,
            currency: "USD".into(),
            start_at: "2026-03-12T00:00:00Z".into(),
            end_at: "2026-03-15T00:00:00Z".into(),
            increment_rules: vec![
                AuctionIncrementRule {
                    after_bid_count: 0,
                    min_increment_cents: 100,
                },
                AuctionIncrementRule {
                    after_bid_count: 10,
                    min_increment_cents: 200,
                },
            ],
        }
    }

    #[test]
    fn v160_auction_window_and_increment_rules_are_enforced() {
        let policy = auction();
        assert!(auction_open("2026-03-13T00:00:00Z", &policy));
        assert!(!auction_open("2026-03-15T00:00:00Z", &policy));
        assert!(validate_bid(&policy, None, 0, 100).allowed);
        assert!(!validate_bid(&policy, Some(1_000), 10, 1_100).allowed);
    }

    #[test]
    fn v160_auction_finalizes_only_after_deadline_with_leader() {
        let leader = Some("buyer_a".to_string());
        assert!(should_auto_finalize(
            "2026-03-15T00:00:00Z",
            &auction(),
            false,
            leader.as_ref()
        ));
        assert!(seller_selection_disabled_in_auction());
    }
}
