use crate::css_bid_ledger::types::LedgerEntry;

pub const CREATE_CSS_BID_LEDGER_ENTRIES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_bid_ledger_entries (
    ledger_id TEXT PRIMARY KEY,
    catalog_id TEXT NOT NULL,
    event_kind TEXT NOT NULL,
    bid_id TEXT,
    bidder_user_id TEXT,
    bid_price_cents BIGINT,
    min_required_cents BIGINT,
    previous_leader_user_id TEXT,
    new_leader_user_id TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn insert_ledger_entry(_pool: &sqlx::PgPool, _entry: &LedgerEntry) -> anyhow::Result<()> {
    anyhow::bail!("css bid ledger insert_ledger_entry is not wired yet")
}

pub async fn list_entries_for_catalog(
    _pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<Vec<LedgerEntry>> {
    anyhow::bail!("css bid ledger list_entries_for_catalog is not wired yet for {catalog_id}")
}

pub async fn get_latest_leader_entry(
    _pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<Option<LedgerEntry>> {
    anyhow::bail!("css bid ledger get_latest_leader_entry is not wired yet for {catalog_id}")
}

pub async fn count_entries_for_catalog(
    _pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<i32> {
    anyhow::bail!("css bid ledger count_entries_for_catalog is not wired yet for {catalog_id}")
}
