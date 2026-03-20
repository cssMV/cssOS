use crate::css_market_view_engine::types::{
    AuctionViewState, BidInputAdjustment, CssMarketView, MarketActionState, MarketViewActions,
    MarketViewHeader,
};

pub async fn build_market_view(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    viewer_user_id: &str,
) -> anyhow::Result<CssMarketView> {
    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    let ledger_snapshot = crate::css_bid_ledger::runtime::build_snapshot(pool, catalog_id)
        .await
        .ok();

    let preview_seconds = crate::css_policy_engine::runtime::preview_seconds();
    let sale_mode = entry.sale_policy.mode.clone();
    let priceless = entry.priceless;
    let finalized = ledger_snapshot
        .as_ref()
        .map(|snapshot| snapshot.finalized)
        .unwrap_or(false);

    let bid_assist = if matches!(
        sale_mode,
        crate::css_catalog_engine::types::ListingMode::TimedAuction
    ) {
        let current_price_cents = ledger_snapshot
            .as_ref()
            .and_then(|snapshot| snapshot.current_price_cents);
        let min_increment_cents = entry.sale_policy.auction.as_ref().map(|auction| {
            crate::css_catalog_engine::policy::current_min_increment(
                auction,
                ledger_snapshot
                    .as_ref()
                    .map(|snapshot| snapshot.total_entries)
                    .unwrap_or(0),
            )
        });

        crate::css_market_view_engine::composer::compose_bid_assist(
            current_price_cents,
            min_increment_cents,
        )
    } else {
        None
    };

    if !viewer_user_id.is_empty() {
        let initial_score = crate::css_policy_engine::runtime::credit_initial_score();
        if let Ok((owner_credit, _)) =
            crate::css_governance_timeline::store_pg::get_or_create_credit_profile(
                pool,
                &entry.owner_user_id,
                initial_score,
            )
            .await
        {
            let policy_version_id =
                crate::css_rule_audit::runtime::resolve_policy_version_id_for_subject(
                    pool,
                    crate::css_policy_versioning::types::PolicyBindingSubjectKind::Catalog,
                    catalog_id,
                )
                .await;
            let _ = crate::css_rule_audit::runtime::audit_credit_warning(
                pool,
                viewer_user_id,
                &entry.owner_user_id,
                &policy_version_id,
                crate::css_policy_engine::runtime::credit_low_warning_threshold(),
                owner_credit.score,
                &chrono::Utc::now().to_rfc3339(),
            )
            .await;
        }
    }

    Ok(CssMarketView {
        header: MarketViewHeader {
            title: entry.title.clone(),
            owner_user_id: Some(entry.owner_user_id.clone()),
            sale_mode: format!("{:?}", sale_mode).to_lowercase(),
            priceless,
        },
        preview_seconds,
        auction: ledger_snapshot.map(|snapshot| AuctionViewState {
            current_leader_user_id: snapshot.current_leader_user_id,
            current_price_cents: snapshot.current_price_cents,
            ends_at: entry
                .sale_policy
                .auction
                .as_ref()
                .map(|auction| auction.end_at.clone()),
            bid_count: snapshot.total_entries,
            finalized: snapshot.finalized,
        }),
        bid_assist,
        actions: MarketViewActions {
            preview: crate::css_market_view_engine::policy::preview_action_state(),
            listen: MarketActionState::Enabled,
            bid: crate::css_market_view_engine::policy::bid_action_state(&sale_mode, finalized),
            buyout: crate::css_market_view_engine::policy::buyout_action_state(
                priceless, &sale_mode,
            ),
            download: MarketActionState::Disabled,
        },
        hints: crate::css_market_view_engine::composer::compose_hints(
            priceless,
            &sale_mode,
            preview_seconds,
        ),
    })
}

pub async fn normalize_bid_input(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    user_bid_cents: i64,
) -> anyhow::Result<BidInputAdjustment> {
    let view = build_market_view(pool, catalog_id, "").await?;
    let assist = view
        .bid_assist
        .ok_or_else(|| anyhow::anyhow!("bid assist unavailable"))?;
    let current_price_cents = assist
        .current_price_cents
        .ok_or_else(|| anyhow::anyhow!("missing current price"))?;
    let min_increment_cents = assist
        .min_increment_cents
        .ok_or_else(|| anyhow::anyhow!("missing min increment"))?;

    if crate::css_policy_engine::runtime::invalid_bid_auto_adjust_enabled() {
        Ok(
            crate::css_market_view_engine::policy::auto_adjust_bid_to_min_valid(
                current_price_cents,
                min_increment_cents,
                user_bid_cents,
            ),
        )
    } else {
        Ok(BidInputAdjustment {
            original_bid_cents: user_bid_cents,
            adjusted_bid_cents: user_bid_cents,
            auto_adjusted: false,
            message: "当前平台未启用自动纠偏。".into(),
        })
    }
}
