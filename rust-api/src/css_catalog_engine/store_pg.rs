use crate::css_catalog_engine::types::{
    AuctionIncrementRule, CatalogAssetVariant, CatalogEntry, CatalogSalePolicy,
};

pub const CREATE_CSS_CATALOG_ENTRIES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_catalog_entries (
    catalog_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL,
    title TEXT NOT NULL,
    owner_user_id TEXT NOT NULL,
    work_structure TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_id TEXT,
    lang TEXT,
    priceless BOOLEAN DEFAULT FALSE,
    sale_mode TEXT NOT NULL,
    fixed_price_cents BIGINT,
    fixed_price_currency TEXT,
    auction_start_price_cents BIGINT,
    auction_currency TEXT,
    auction_start_at TIMESTAMP,
    auction_end_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub const CREATE_CSS_CATALOG_VARIANTS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_catalog_variants (
    variant_id TEXT PRIMARY KEY,
    catalog_id TEXT NOT NULL,
    lang TEXT,
    voice TEXT,
    output TEXT
)
"#;

pub const CREATE_CSS_CATALOG_AUCTION_INCREMENT_RULES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_catalog_auction_increment_rules (
    rule_id TEXT PRIMARY KEY,
    catalog_id TEXT NOT NULL,
    after_bid_count INT NOT NULL,
    min_increment_cents BIGINT NOT NULL
)
"#;

pub async fn insert_catalog_entry(
    _pool: &sqlx::PgPool,
    _entry: &CatalogEntry,
) -> anyhow::Result<()> {
    anyhow::bail!("css catalog insert_catalog_entry is not wired yet")
}

pub async fn get_catalog_entry(
    _pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<CatalogEntry> {
    anyhow::bail!("css catalog get_catalog_entry is not wired yet for {catalog_id}")
}

pub async fn list_catalog_variants(
    _pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<Vec<CatalogAssetVariant>> {
    anyhow::bail!("css catalog list_catalog_variants is not wired yet for {catalog_id}")
}

pub async fn list_auction_increment_rules(
    _pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<Vec<AuctionIncrementRule>> {
    anyhow::bail!("css catalog list_auction_increment_rules is not wired yet for {catalog_id}")
}

pub async fn update_sale_policy(
    _pool: &sqlx::PgPool,
    _catalog_id: &str,
    _sale_policy: &CatalogSalePolicy,
) -> anyhow::Result<()> {
    anyhow::bail!("css catalog update_sale_policy is not wired yet")
}

pub async fn list_catalogs_by_owner_user_id(
    _pool: &sqlx::PgPool,
    owner_user_id: &str,
) -> anyhow::Result<Vec<CatalogEntry>> {
    anyhow::bail!("css catalog list_catalogs_by_owner_user_id is not wired yet for {owner_user_id}")
}
