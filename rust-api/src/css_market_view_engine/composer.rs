use crate::css_catalog_engine::types::ListingMode;
use crate::css_market_view_engine::types::BidAssistView;

pub fn compose_bid_assist(
    current_price_cents: Option<i64>,
    min_increment_cents: Option<i64>,
) -> Option<BidAssistView> {
    match (current_price_cents, min_increment_cents) {
        (Some(current_price_cents), Some(min_increment_cents)) => Some(BidAssistView {
            current_price_cents: Some(current_price_cents),
            min_increment_cents: Some(min_increment_cents),
            min_valid_next_bid_cents: Some(current_price_cents + min_increment_cents),
        }),
        _ => None,
    }
}

pub fn compose_hints(
    priceless: bool,
    sale_mode: &ListingMode,
    preview_seconds: u32,
) -> Vec<String> {
    let mut hints = Vec::new();
    hints.push(format!("所有作品均可免费预览 {} 秒", preview_seconds));

    if priceless {
        hints.push("该作品已被设置为无价之宝，不开放买断。".into());
    }

    if matches!(sale_mode, ListingMode::TimedAuction) {
        hints.push("当前作品处于限时竞拍中，卖家无权选择买家，价高者得。".into());
    }

    hints
}

#[cfg(test)]
mod tests {
    use crate::css_catalog_engine::types::ListingMode;
    use crate::css_market_view_engine::composer::{compose_bid_assist, compose_hints};

    #[test]
    fn v162_bid_assist_computes_minimum_valid_next_bid() {
        let assist = compose_bid_assist(Some(100), Some(5)).expect("assist");
        assert_eq!(assist.min_valid_next_bid_cents, Some(105));
    }

    #[test]
    fn v162_hints_include_preview_and_auction_guidance() {
        let hints = compose_hints(true, &ListingMode::TimedAuction, 30);
        assert!(hints.iter().any(|h| h.contains("30 秒")));
        assert!(hints.iter().any(|h| h.contains("无价之宝")));
        assert!(hints.iter().any(|h| h.contains("价高者得")));
    }
}
