use crate::css_auto_bid_engine::types::CssAutoBidConfig;

pub const CREATE_CSS_AUTO_BIDS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_auto_bids (
    auto_bid_id TEXT PRIMARY KEY,
    catalog_id TEXT NOT NULL,
    bidder_user_id TEXT NOT NULL,
    max_bid_cents BIGINT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn upsert_auto_bid(_pool: &sqlx::PgPool, _cfg: &CssAutoBidConfig) -> anyhow::Result<()> {
    anyhow::bail!("css auto bid upsert_auto_bid is not wired yet")
}

pub async fn get_active_auto_bids_for_catalog(
    _pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<Vec<CssAutoBidConfig>> {
    anyhow::bail!("css auto bid get_active_auto_bids_for_catalog is not wired yet for {catalog_id}")
}

pub async fn get_auto_bid_for_user(
    _pool: &sqlx::PgPool,
    catalog_id: &str,
    bidder_user_id: &str,
) -> anyhow::Result<Option<CssAutoBidConfig>> {
    anyhow::bail!(
        "css auto bid get_auto_bid_for_user is not wired yet for {catalog_id}:{bidder_user_id}"
    )
}

pub async fn mark_auto_bid_exhausted(
    _pool: &sqlx::PgPool,
    _auto_bid_id: &str,
) -> anyhow::Result<()> {
    anyhow::bail!("css auto bid mark_auto_bid_exhausted is not wired yet")
}

pub async fn mark_auto_bid_won(_pool: &sqlx::PgPool, _auto_bid_id: &str) -> anyhow::Result<()> {
    anyhow::bail!("css auto bid mark_auto_bid_won is not wired yet")
}

pub async fn mark_auto_bid_lost(_pool: &sqlx::PgPool, _auto_bid_id: &str) -> anyhow::Result<()> {
    anyhow::bail!("css auto bid mark_auto_bid_lost is not wired yet")
}

pub async fn mark_auto_bid_cancelled(
    _pool: &sqlx::PgPool,
    _auto_bid_id: &str,
) -> anyhow::Result<()> {
    anyhow::bail!("css auto bid mark_auto_bid_cancelled is not wired yet")
}
