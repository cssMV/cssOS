pub fn message_bid_submitted(bidder_user_id: &str, bid_price_cents: i64) -> String {
    format!("用户 {} 提交出价 {}", bidder_user_id, bid_price_cents)
}

pub fn message_bid_rejected(
    bidder_user_id: &str,
    bid_price_cents: i64,
    min_required_cents: i64,
) -> String {
    format!(
        "用户 {} 出价 {} 被拒绝，当前最低有效出价为 {}",
        bidder_user_id, bid_price_cents, min_required_cents
    )
}

pub fn message_leader_changed(previous: Option<&str>, new_leader: &str, new_price: i64) -> String {
    match previous {
        Some(prev) => format!(
            "领先者从 {} 变更为 {}，最新领先价 {}",
            prev, new_leader, new_price
        ),
        None => format!("首位领先者 {} 形成，领先价 {}", new_leader, new_price),
    }
}

pub fn message_auction_finalized(winner: &str, price: i64) -> String {
    format!("竞拍截止，赢家 {} 以 {} 自动锁定", winner, price)
}

#[cfg(test)]
mod tests {
    use crate::css_bid_ledger::policy::{
        message_auction_finalized, message_bid_rejected, message_bid_submitted,
        message_leader_changed,
    };

    #[test]
    fn v161_ledger_messages_capture_bid_and_leader_context() {
        assert!(message_bid_submitted("user_a", 100).contains("user_a"));
        assert!(message_bid_rejected("user_b", 110, 120).contains("120"));
        assert!(message_leader_changed(Some("user_a"), "user_b", 200).contains("user_b"));
        assert!(message_auction_finalized("user_c", 300).contains("user_c"));
    }
}
