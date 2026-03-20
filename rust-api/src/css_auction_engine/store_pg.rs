use crate::css_auction_engine::types::{AuctionBid, AuctionWinner};

pub const CREATE_CSS_AUCTION_BIDS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_auction_bids (
    bid_id TEXT PRIMARY KEY,
    catalog_id TEXT NOT NULL,
    bidder_user_id TEXT NOT NULL,
    bid_price_cents BIGINT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub const CREATE_CSS_AUCTION_WINNERS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_auction_winners (
    catalog_id TEXT PRIMARY KEY,
    bidder_user_id TEXT NOT NULL,
    winning_price_cents BIGINT NOT NULL,
    currency TEXT NOT NULL,
    locked_at TIMESTAMP NOT NULL
)
"#;

pub async fn insert_bid(_pool: &sqlx::PgPool, _bid: &AuctionBid) -> anyhow::Result<()> {
    anyhow::bail!("css auction insert_bid is not wired yet")
}

pub async fn list_bids_for_catalog(
    _pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<Vec<AuctionBid>> {
    anyhow::bail!("css auction list_bids_for_catalog is not wired yet for {catalog_id}")
}

pub async fn get_highest_bid_for_catalog(
    _pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<Option<AuctionBid>> {
    anyhow::bail!("css auction get_highest_bid_for_catalog is not wired yet for {catalog_id}")
}

pub async fn count_bids_for_catalog(_pool: &sqlx::PgPool, catalog_id: &str) -> anyhow::Result<i32> {
    anyhow::bail!("css auction count_bids_for_catalog is not wired yet for {catalog_id}")
}

pub async fn mark_previous_winning_bids_outbid(
    _pool: &sqlx::PgPool,
    _catalog_id: &str,
) -> anyhow::Result<()> {
    anyhow::bail!("css auction mark_previous_winning_bids_outbid is not wired yet")
}

pub async fn mark_bid_winning(_pool: &sqlx::PgPool, _bid_id: &str) -> anyhow::Result<()> {
    anyhow::bail!("css auction mark_bid_winning is not wired yet")
}

pub async fn insert_winner(_pool: &sqlx::PgPool, _winner: &AuctionWinner) -> anyhow::Result<()> {
    anyhow::bail!("css auction insert_winner is not wired yet")
}

pub async fn get_winner(
    _pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<Option<AuctionWinner>> {
    anyhow::bail!("css auction get_winner is not wired yet for {catalog_id}")
}
