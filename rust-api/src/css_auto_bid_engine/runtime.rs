use crate::css_auto_bid_engine::types::{AutoBidResolution, AutoBidStatus, CssAutoBidConfig};

pub async fn upsert_auto_bid(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    bidder_user_id: &str,
    max_bid_cents: i64,
    currency: &str,
) -> anyhow::Result<CssAutoBidConfig> {
    let ts = crate::css_ts_runtime::runtime::evaluate_enable_auto_bid(
        pool,
        bidder_user_id,
        catalog_id,
        max_bid_cents,
    )
    .await?;
    if !matches!(
        ts.decision,
        crate::css_ts_runtime::types::TsDecisionKind::Allow
    ) {
        anyhow::bail!("{}", ts.message);
    }

    let dispute = crate::css_dispute_engine::runtime::check_auto_bid_allowed(
        pool,
        catalog_id,
        bidder_user_id,
    )
    .await?;
    if !dispute.allowed {
        anyhow::bail!("{}", dispute.message);
    }
    let participation = crate::css_reputation_engine::runtime::check_auction_participation_allowed(
        pool,
        bidder_user_id,
    )
    .await?;
    if !participation.allowed {
        anyhow::bail!("{}", participation.message);
    }
    let auto_bid =
        crate::css_reputation_engine::runtime::check_auto_bid_allowed(pool, bidder_user_id).await?;
    if !auto_bid.allowed {
        anyhow::bail!("{}", auto_bid.message);
    }

    let cfg = CssAutoBidConfig {
        auto_bid_id: format!("ab_{}", uuid::Uuid::new_v4()),
        catalog_id: catalog_id.to_string(),
        bidder_user_id: bidder_user_id.to_string(),
        max_bid_cents,
        currency: currency.to_string(),
        status: AutoBidStatus::Active,
        created_at: chrono::Utc::now().to_rfc3339(),
    };

    crate::css_auto_bid_engine::store_pg::upsert_auto_bid(pool, &cfg).await?;
    Ok(cfg)
}

pub async fn react_to_new_highest_bid(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    new_leader_user_id: &str,
    new_price_cents: i64,
    min_increment_cents: i64,
) -> anyhow::Result<Vec<AutoBidResolution>> {
    let configs =
        crate::css_auto_bid_engine::store_pg::get_active_auto_bids_for_catalog(pool, catalog_id)
            .await?;
    let mut resolutions = Vec::new();

    for cfg in configs {
        if cfg.bidder_user_id == new_leader_user_id {
            continue;
        }

        let decision = crate::css_auto_bid_engine::policy::can_auto_bid(
            cfg.max_bid_cents,
            new_price_cents,
            min_increment_cents,
        );

        if !decision.should_bid {
            crate::css_auto_bid_engine::store_pg::mark_auto_bid_exhausted(pool, &cfg.auto_bid_id)
                .await?;
            resolutions.push(AutoBidResolution {
                placed_bid: false,
                bid_price_cents: None,
                leader_user_id: Some(new_leader_user_id.to_string()),
                code: decision.code,
                message: decision.message,
            });
            continue;
        }

        let next_bid_cents = decision
            .next_bid_cents
            .ok_or_else(|| anyhow::anyhow!("auto bid decision missing next bid"))?;

        crate::css_auction_engine::runtime::place_bid(
            pool,
            catalog_id,
            cfg.bidder_user_id.clone(),
            next_bid_cents,
            &chrono::Utc::now().to_rfc3339(),
        )
        .await?;

        resolutions.push(AutoBidResolution {
            placed_bid: true,
            bid_price_cents: Some(next_bid_cents),
            leader_user_id: Some(cfg.bidder_user_id.clone()),
            code: "auto_bid_placed".into(),
            message: format!("系统已自动代拍到 {}", next_bid_cents),
        });
    }

    Ok(resolutions)
}

pub fn resolve_two_auto_bidders(
    a_user_id: &str,
    a_max_cents: i64,
    b_user_id: &str,
    b_max_cents: i64,
    current_price_cents: i64,
    min_increment_cents: i64,
) -> AutoBidResolution {
    let (winner, price) = crate::css_auto_bid_engine::policy::resolve_dual_auto_bid(
        a_user_id,
        a_max_cents,
        b_user_id,
        b_max_cents,
        current_price_cents,
        min_increment_cents,
    );

    AutoBidResolution {
        placed_bid: true,
        bid_price_cents: Some(price),
        leader_user_id: Some(winner.clone()),
        code: "dual_auto_bid_resolved".into(),
        message: format!("自动代拍对撞完成，{} 以 {} 暂时领先", winner, price),
    }
}
