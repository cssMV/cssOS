use crate::css_ownership_engine::types::{
    OwnershipRecord, OwnershipTransferIntent, StoredOwnershipTransferIntent, TransferIntentStatus,
};

pub const CREATE_CSS_OWNERSHIPS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_ownerships (
    ownership_id TEXT PRIMARY KEY,
    owner_user_id TEXT NOT NULL,
    work_structure TEXT NOT NULL,
    unit TEXT NOT NULL,
    unit_id TEXT,
    lang TEXT,
    priceless BOOLEAN DEFAULT FALSE,
    buyout_price_cents BIGINT,
    currency TEXT,
    resale_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub const CREATE_CSS_OWNERSHIP_TRANSFER_INTENTS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_ownership_transfer_intents (
    intent_id TEXT PRIMARY KEY,
    buyer_user_id TEXT NOT NULL,
    ownership_id TEXT NOT NULL,
    offered_price_cents BIGINT,
    currency TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn insert_ownership(
    _pool: &sqlx::PgPool,
    _ownership: &OwnershipRecord,
) -> anyhow::Result<()> {
    anyhow::bail!("css ownership store_pg is not wired to PostgreSQL yet")
}

pub async fn get_ownership(
    _pool: &sqlx::PgPool,
    ownership_id: &str,
) -> anyhow::Result<OwnershipRecord> {
    anyhow::bail!("css ownership get_ownership not wired yet for {ownership_id}")
}

pub async fn update_ownership_sale_config(
    _pool: &sqlx::PgPool,
    _ownership_id: &str,
    _buyout_price_cents: Option<i64>,
    _currency: Option<String>,
    _resale_enabled: bool,
    _priceless: bool,
) -> anyhow::Result<()> {
    anyhow::bail!("css ownership update_ownership_sale_config is not wired yet")
}

pub async fn insert_transfer_intent(
    _pool: &sqlx::PgPool,
    _intent: &OwnershipTransferIntent,
) -> anyhow::Result<()> {
    anyhow::bail!("css ownership insert_transfer_intent is not wired yet")
}

pub async fn get_transfer_intent(
    _pool: &sqlx::PgPool,
    intent_id: &str,
) -> anyhow::Result<StoredOwnershipTransferIntent> {
    anyhow::bail!("css ownership get_transfer_intent is not wired yet for {intent_id}")
}

pub async fn mark_transfer_intent_accepted(
    _pool: &sqlx::PgPool,
    _intent_id: &str,
) -> anyhow::Result<()> {
    anyhow::bail!("css ownership mark_transfer_intent_accepted is not wired yet")
}

pub async fn mark_transfer_intent_rejected(
    _pool: &sqlx::PgPool,
    _intent_id: &str,
) -> anyhow::Result<()> {
    anyhow::bail!("css ownership mark_transfer_intent_rejected is not wired yet")
}

pub async fn transfer_ownership(
    _pool: &sqlx::PgPool,
    _ownership_id: &str,
    _new_owner_user_id: &str,
) -> anyhow::Result<()> {
    anyhow::bail!("css ownership transfer_ownership is not wired yet")
}

pub async fn list_ownerships_by_owner_user_id(
    _pool: &sqlx::PgPool,
    owner_user_id: &str,
) -> anyhow::Result<Vec<OwnershipRecord>> {
    anyhow::bail!(
        "css ownership list_ownerships_by_owner_user_id is not wired yet for {owner_user_id}"
    )
}

#[allow(dead_code)]
fn _status_name(status: TransferIntentStatus) -> &'static str {
    match status {
        TransferIntentStatus::Pending => "pending",
        TransferIntentStatus::Accepted => "accepted",
        TransferIntentStatus::Rejected => "rejected",
        TransferIntentStatus::Cancelled => "cancelled",
    }
}
