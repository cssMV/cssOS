use crate::css_catalog_engine::types::{CatalogEntry, ListingMode};

pub async fn create_catalog_entry(pool: &sqlx::PgPool, entry: CatalogEntry) -> anyhow::Result<()> {
    if !crate::css_catalog_engine::policy::sale_mode_allowed(&entry) {
        anyhow::bail!("sale mode not allowed for catalog entry");
    }
    if matches!(
        entry.sale_policy.mode,
        crate::css_catalog_engine::types::ListingMode::TimedAuction
    ) {
        let moderation = crate::css_moderation_engine::runtime::check_owner_can_create_auction(
            pool,
            &entry.owner_user_id,
        )
        .await?;
        if !moderation.allowed {
            anyhow::bail!("{}", moderation.message);
        }
        let reputation = crate::css_reputation_engine::runtime::check_auction_creation_allowed(
            pool,
            &entry.owner_user_id,
        )
        .await?;
        if !reputation.allowed {
            anyhow::bail!("{}", reputation.message);
        }
    }
    crate::css_catalog_engine::store_pg::insert_catalog_entry(pool, &entry).await
}

pub async fn get_listing_mode(
    pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<ListingMode> {
    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    Ok(entry.sale_policy.mode)
}

pub async fn seller_can_select_buyer(
    pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<bool> {
    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    Ok(crate::css_catalog_engine::policy::seller_can_choose_buyer(
        &entry.sale_policy.mode,
    ))
}

pub async fn validate_auction_bid(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    current_highest_cents: Option<i64>,
    current_bid_count: i32,
    new_bid_cents: i64,
) -> anyhow::Result<bool> {
    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    let auction = entry
        .sale_policy
        .auction
        .ok_or_else(|| anyhow::anyhow!("catalog entry is not auction mode"))?;
    Ok(crate::css_catalog_engine::policy::bid_valid(
        &auction,
        current_highest_cents,
        current_bid_count,
        new_bid_cents,
    ))
}

pub async fn finalize_auction_if_due(
    pool: &sqlx::PgPool,
    catalog_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<()> {
    let entry = crate::css_catalog_engine::store_pg::get_catalog_entry(pool, catalog_id).await?;
    if !matches!(entry.sale_policy.mode, ListingMode::TimedAuction) {
        return Ok(());
    }
    let auction = entry
        .sale_policy
        .auction
        .ok_or_else(|| anyhow::anyhow!("missing auction policy"))?;
    if now_rfc3339 < auction.end_at.as_str() {
        return Ok(());
    }
    Ok(())
}
