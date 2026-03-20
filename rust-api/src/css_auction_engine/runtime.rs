use crate::css_auction_engine::types::{
    AuctionBid, AuctionBidStatus, AuctionFinalizeResult, AuctionWinner,
};

pub async fn place_bid(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    bidder_user_id: String,
    bid_price_cents: i64,
    now_rfc3339: &str,
) -> anyhow::Result<AuctionBid> {
    let ts = crate::css_ts_runtime::runtime::evaluate_submit_bid(
        pool,
        &bidder_user_id,
        catalog_id,
        bid_price_cents,
    )
    .await?;
    if !matches!(
        ts.decision,
        crate::css_ts_runtime::types::TsDecisionKind::Allow
    ) {
        anyhow::bail!("{}", ts.message);
    }

    let dispute = crate::css_dispute_engine::runtime::check_manual_bid_allowed(
        pool,
        catalog_id,
        &bidder_user_id,
    )
    .await?;
    if !dispute.allowed {
        anyhow::bail!("{}", dispute.message);
    }
    let moderation = crate::css_moderation_engine::runtime::check_user_can_participate_auction(
        pool,
        &bidder_user_id,
    )
    .await?;
    if !moderation.allowed {
        anyhow::bail!("{}", moderation.message);
    }
    let reputation = crate::css_reputation_engine::runtime::check_auction_participation_allowed(
        pool,
        &bidder_user_id,
    )
    .await?;
    if !reputation.allowed {
        anyhow::bail!("{}", reputation.message);
    }

    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    if !matches!(
        entry.sale_policy.mode,
        crate::css_catalog_engine::types::ListingMode::TimedAuction
    ) {
        anyhow::bail!("catalog item is not in timed auction mode");
    }
    let auction = entry
        .sale_policy
        .auction
        .ok_or_else(|| anyhow::anyhow!("missing auction policy"))?;
    if !crate::css_auction_engine::policy::auction_open(now_rfc3339, &auction) {
        anyhow::bail!("auction is not open");
    }
    let highest =
        crate::css_auction_engine::store_pg::get_highest_bid_for_catalog(pool, catalog_id).await?;
    let current_highest_cents = highest.as_ref().map(|bid| bid.bid_price_cents);
    let current_bid_count =
        crate::css_auction_engine::store_pg::count_bids_for_catalog(pool, catalog_id).await?;
    let check = crate::css_auction_engine::policy::validate_bid(
        &auction,
        current_highest_cents,
        current_bid_count,
        bid_price_cents,
    );
    if !check.allowed {
        anyhow::bail!("{}", check.message);
    }
    if highest.is_some() {
        crate::css_auction_engine::store_pg::mark_previous_winning_bids_outbid(pool, catalog_id)
            .await?;
    }
    let bid = AuctionBid {
        bid_id: format!("bid_{}", uuid::Uuid::new_v4()),
        catalog_id: catalog_id.to_string(),
        bidder_user_id,
        bid_price_cents,
        currency: auction.currency.clone(),
        status: AuctionBidStatus::Winning,
        created_at: now_rfc3339.to_string(),
    };
    crate::css_auction_engine::store_pg::insert_bid(pool, &bid).await?;
    crate::css_auction_engine::store_pg::mark_bid_winning(pool, &bid.bid_id).await?;
    Ok(bid)
}

pub async fn finalize_auction_if_due(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<AuctionFinalizeResult> {
    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    if !matches!(
        entry.sale_policy.mode,
        crate::css_catalog_engine::types::ListingMode::TimedAuction
    ) {
        return Ok(AuctionFinalizeResult {
            locked: false,
            winner: None,
            code: "not_auction_mode".into(),
            message: "当前目录项不是竞拍模式。".into(),
        });
    }
    let auction = entry
        .sale_policy
        .auction
        .ok_or_else(|| anyhow::anyhow!("missing auction policy"))?;
    let already = crate::css_auction_engine::store_pg::get_winner(pool, catalog_id).await?;
    if already.is_some() {
        return Ok(AuctionFinalizeResult {
            locked: true,
            winner: already,
            code: "already_finalized".into(),
            message: "竞拍已完成自动锁定。".into(),
        });
    }
    let highest =
        crate::css_auction_engine::store_pg::get_highest_bid_for_catalog(pool, catalog_id).await?;
    let Some(highest) = highest else {
        return Ok(AuctionFinalizeResult {
            locked: false,
            winner: None,
            code: "no_valid_bid".into(),
            message: "当前没有有效出价，竞拍不生成赢家。".into(),
        });
    };
    if !crate::css_auction_engine::policy::should_auto_finalize(
        now_rfc3339,
        &auction,
        false,
        Some(&highest.bidder_user_id),
    ) {
        return Ok(AuctionFinalizeResult {
            locked: false,
            winner: None,
            code: "auction_not_due".into(),
            message: "竞拍尚未到截止时间。".into(),
        });
    }
    let winner = AuctionWinner {
        catalog_id: catalog_id.to_string(),
        bidder_user_id: highest.bidder_user_id.clone(),
        winning_price_cents: highest.bid_price_cents,
        currency: highest.currency.clone(),
        locked_at: now_rfc3339.to_string(),
    };
    crate::css_auction_engine::store_pg::insert_winner(pool, &winner).await?;
    Ok(AuctionFinalizeResult {
        locked: true,
        winner: Some(winner),
        code: "auction_finalized".into(),
        message: "竞拍截止，最高有效出价者已自动锁定。".into(),
    })
}

pub async fn create_deal_from_auction_winner(
    pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<()> {
    let _winner = crate::css_auction_engine::store_pg::get_winner(pool, catalog_id)
        .await?
        .ok_or_else(|| anyhow::anyhow!("auction winner not found"))?;
    Ok(())
}
