use crate::css_auto_bid_engine::types::AutoBidDecision;

pub fn min_valid_next_bid(current_price_cents: i64, min_increment_cents: i64) -> i64 {
    current_price_cents + min_increment_cents
}

pub fn can_auto_bid(
    max_bid_cents: i64,
    current_price_cents: i64,
    min_increment_cents: i64,
) -> AutoBidDecision {
    let next_required = min_valid_next_bid(current_price_cents, min_increment_cents);

    if max_bid_cents < next_required {
        return AutoBidDecision {
            should_bid: false,
            next_bid_cents: None,
            code: "max_below_next_required".into(),
            message: format!(
                "自动代拍上限 {} 低于当前最低有效下一口价 {}",
                max_bid_cents, next_required
            ),
        };
    }

    AutoBidDecision {
        should_bid: true,
        next_bid_cents: Some(next_required),
        code: "auto_bid_allowed".into(),
        message: format!("自动代拍可继续，下一口为 {}", next_required),
    }
}

pub fn resolve_against_manual_jump(
    auto_bid_max_cents: i64,
    opponent_bid_cents: i64,
    min_increment_cents: i64,
) -> AutoBidDecision {
    can_auto_bid(auto_bid_max_cents, opponent_bid_cents, min_increment_cents)
}

pub fn resolve_dual_auto_bid(
    a_user_id: &str,
    a_max_cents: i64,
    b_user_id: &str,
    b_max_cents: i64,
    current_price_cents: i64,
    min_increment_cents: i64,
) -> (String, i64) {
    if a_max_cents == b_max_cents {
        return (
            a_user_id.to_string(),
            a_max_cents.max(current_price_cents + min_increment_cents),
        );
    }

    let (winner_id, winner_max, loser_max) = if a_max_cents > b_max_cents {
        (a_user_id, a_max_cents, b_max_cents)
    } else {
        (b_user_id, b_max_cents, a_max_cents)
    };

    let target = loser_max + min_increment_cents;
    let final_price = target
        .min(winner_max)
        .max(current_price_cents + min_increment_cents);

    (winner_id.to_string(), final_price)
}

#[cfg(test)]
mod tests {
    use crate::css_auto_bid_engine::policy::{
        can_auto_bid, min_valid_next_bid, resolve_against_manual_jump, resolve_dual_auto_bid,
    };

    #[test]
    fn v163_manual_jump_is_allowed_but_auto_bid_uses_minimum_valid_step() {
        assert_eq!(min_valid_next_bid(100, 5), 105);

        let decision = can_auto_bid(500, 120, 5);
        assert!(decision.should_bid);
        assert_eq!(decision.next_bid_cents, Some(125));
    }

    #[test]
    fn v163_auto_bid_exhausts_when_manual_jump_clears_its_ceiling() {
        let decision = resolve_against_manual_jump(300, 500, 5);
        assert!(!decision.should_bid);
        assert_eq!(decision.code, "max_below_next_required");
    }

    #[test]
    fn v163_dual_auto_bid_resolves_to_higher_ceiling_near_second_highest_limit() {
        let (winner, price) = resolve_dual_auto_bid("a", 300, "b", 500, 100, 5);
        assert_eq!(winner, "b");
        assert_eq!(price, 305);
    }
}
