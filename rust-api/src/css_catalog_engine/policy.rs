use crate::css_catalog_engine::types::{AuctionPolicy, CatalogEntry, ListingMode};

pub fn sale_mode_allowed(entry: &CatalogEntry) -> bool {
    if entry.priceless {
        return !matches!(
            entry.sale_policy.mode,
            ListingMode::FixedPrice | ListingMode::TimedAuction
        );
    }
    true
}

pub fn auction_requires_highest_bid_wins(mode: &ListingMode) -> bool {
    matches!(mode, ListingMode::TimedAuction)
}

pub fn seller_can_choose_buyer(mode: &ListingMode) -> bool {
    !matches!(mode, ListingMode::TimedAuction)
}

pub fn current_min_increment(auction: &AuctionPolicy, current_bid_count: i32) -> i64 {
    let mut current = 0i64;
    for rule in &auction.increment_rules {
        if current_bid_count >= rule.after_bid_count {
            current = rule.min_increment_cents;
        }
    }
    current
}

pub fn bid_valid(
    auction: &AuctionPolicy,
    current_highest_cents: Option<i64>,
    current_bid_count: i32,
    new_bid_cents: i64,
) -> bool {
    match current_highest_cents {
        None => new_bid_cents >= auction.start_price_cents,
        Some(highest) => {
            new_bid_cents >= highest + current_min_increment(auction, current_bid_count)
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::css_catalog_engine::policy::{
        auction_requires_highest_bid_wins, bid_valid, current_min_increment, sale_mode_allowed,
        seller_can_choose_buyer,
    };
    use crate::css_catalog_engine::types::{
        AuctionIncrementRule, AuctionPolicy, CatalogEntry, CatalogSalePolicy, ListingMode,
    };
    use crate::css_ownership_engine::types::OwnershipScope;
    use crate::css_rights_engine::types::{RightsUnit, RightsWorkStructure};

    fn auction_policy() -> AuctionPolicy {
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
    fn v159_auction_mode_disables_seller_choice_and_requires_highest_bid() {
        assert!(!seller_can_choose_buyer(&ListingMode::TimedAuction));
        assert!(auction_requires_highest_bid_wins(
            &ListingMode::TimedAuction
        ));
    }

    #[test]
    fn v159_increment_rules_raise_floor_after_threshold() {
        let auction = auction_policy();
        assert_eq!(current_min_increment(&auction, 0), 100);
        assert_eq!(current_min_increment(&auction, 10), 200);
        assert!(bid_valid(&auction, Some(1_000), 10, 1_200));
        assert!(!bid_valid(&auction, Some(1_000), 10, 1_100));
    }

    #[test]
    fn v159_priceless_catalog_entry_disallows_fixed_price_and_auction_listing() {
        let entry = CatalogEntry {
            catalog_id: "cat_1".into(),
            run_id: "run_1".into(),
            title: "Demo".into(),
            owner_user_id: "owner".into(),
            scope: OwnershipScope {
                work_structure: RightsWorkStructure::Single,
                unit: RightsUnit::WholeWork,
                unit_id: None,
                lang: None,
            },
            priceless: true,
            variants: Vec::new(),
            sale_policy: CatalogSalePolicy {
                mode: ListingMode::FixedPrice,
                fixed_price: None,
                auction: None,
            },
            created_at: "2026-03-12T00:00:00Z".into(),
        };
        assert!(!sale_mode_allowed(&entry));
    }
}
