use crate::css_bid_ledger::types::{
    LedgerAppendRequest, LedgerEntry, LedgerEventKind, LedgerSnapshot,
};

pub async fn append_entry(
    pool: &sqlx::PgPool,
    req: LedgerAppendRequest,
    now_rfc3339: &str,
) -> anyhow::Result<LedgerEntry> {
    let entry = LedgerEntry {
        ledger_id: format!("ledger_{}", uuid::Uuid::new_v4()),
        catalog_id: req.catalog_id,
        event_kind: req.event_kind,
        bid_id: req.bid_id,
        bidder_user_id: req.bidder_user_id,
        bid_price_cents: req.bid_price_cents,
        min_required_cents: req.min_required_cents,
        previous_leader_user_id: req.previous_leader_user_id,
        new_leader_user_id: req.new_leader_user_id,
        message: req.message,
        created_at: now_rfc3339.to_string(),
    };
    crate::css_bid_ledger::store_pg::insert_ledger_entry(pool, &entry).await?;
    Ok(entry)
}

pub async fn record_bid_submitted(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    bidder_user_id: &str,
    bid_price_cents: i64,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    append_entry(
        pool,
        LedgerAppendRequest {
            catalog_id: catalog_id.to_string(),
            event_kind: LedgerEventKind::BidSubmitted,
            bid_id: None,
            bidder_user_id: Some(bidder_user_id.to_string()),
            bid_price_cents: Some(bid_price_cents),
            min_required_cents: None,
            previous_leader_user_id: None,
            new_leader_user_id: None,
            message: crate::css_bid_ledger::policy::message_bid_submitted(
                bidder_user_id,
                bid_price_cents,
            ),
        },
        now_rfc3339,
    )
    .await?;
    Ok(())
}

pub async fn record_bid_rejected(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    bidder_user_id: &str,
    bid_price_cents: i64,
    min_required_cents: i64,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    append_entry(
        pool,
        LedgerAppendRequest {
            catalog_id: catalog_id.to_string(),
            event_kind: LedgerEventKind::BidRejected,
            bid_id: None,
            bidder_user_id: Some(bidder_user_id.to_string()),
            bid_price_cents: Some(bid_price_cents),
            min_required_cents: Some(min_required_cents),
            previous_leader_user_id: None,
            new_leader_user_id: None,
            message: crate::css_bid_ledger::policy::message_bid_rejected(
                bidder_user_id,
                bid_price_cents,
                min_required_cents,
            ),
        },
        now_rfc3339,
    )
    .await?;
    Ok(())
}

pub async fn record_leader_changed(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    previous_leader_user_id: Option<String>,
    new_leader_user_id: String,
    new_price: i64,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    append_entry(
        pool,
        LedgerAppendRequest {
            catalog_id: catalog_id.to_string(),
            event_kind: LedgerEventKind::LeaderChanged,
            bid_id: None,
            bidder_user_id: None,
            bid_price_cents: Some(new_price),
            min_required_cents: None,
            previous_leader_user_id: previous_leader_user_id.clone(),
            new_leader_user_id: Some(new_leader_user_id.clone()),
            message: crate::css_bid_ledger::policy::message_leader_changed(
                previous_leader_user_id.as_deref(),
                &new_leader_user_id,
                new_price,
            ),
        },
        now_rfc3339,
    )
    .await?;
    Ok(())
}

pub async fn record_auction_finalized(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    winner_user_id: &str,
    price_cents: i64,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    append_entry(
        pool,
        LedgerAppendRequest {
            catalog_id: catalog_id.to_string(),
            event_kind: LedgerEventKind::AuctionFinalized,
            bid_id: None,
            bidder_user_id: None,
            bid_price_cents: Some(price_cents),
            min_required_cents: None,
            previous_leader_user_id: None,
            new_leader_user_id: Some(winner_user_id.to_string()),
            message: crate::css_bid_ledger::policy::message_auction_finalized(
                winner_user_id,
                price_cents,
            ),
        },
        now_rfc3339,
    )
    .await?;
    Ok(())
}

pub async fn build_snapshot(
    pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<LedgerSnapshot> {
    let entries =
        crate::css_bid_ledger::store_pg::list_entries_for_catalog(pool, catalog_id).await?;
    let total_entries = entries.len() as i32;
    let mut current_leader_user_id = None;
    let mut current_price_cents = None;
    let mut finalized = false;

    for entry in &entries {
        if let Some(next) = &entry.new_leader_user_id {
            current_leader_user_id = Some(next.clone());
        }
        if entry.bid_price_cents.is_some() {
            current_price_cents = entry.bid_price_cents;
        }
        if matches!(entry.event_kind, LedgerEventKind::AuctionFinalized) {
            finalized = true;
        }
    }

    Ok(LedgerSnapshot {
        catalog_id: catalog_id.to_string(),
        total_entries,
        current_leader_user_id,
        current_price_cents,
        finalized,
    })
}
