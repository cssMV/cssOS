use crate::css_deal_engine::types::{CssDeal, DealIntent};

pub const CREATE_CSS_DEAL_INTENTS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_deal_intents (
    intent_id TEXT PRIMARY KEY,
    ownership_id TEXT NOT NULL,
    seller_user_id TEXT NOT NULL,
    buyer_user_id TEXT NOT NULL,
    offered_price_cents BIGINT,
    currency TEXT,
    status TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub const CREATE_CSS_DEALS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_deals (
    deal_id TEXT PRIMARY KEY,
    ownership_id TEXT NOT NULL,
    seller_user_id TEXT NOT NULL,
    buyer_user_id TEXT NOT NULL,
    intent_id TEXT NOT NULL,
    price_cents BIGINT NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    payment_id TEXT,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn insert_deal_intent(_pool: &sqlx::PgPool, _intent: &DealIntent) -> anyhow::Result<()> {
    anyhow::bail!("css deal insert_deal_intent is not wired yet")
}

pub async fn list_intents_for_ownership(
    _pool: &sqlx::PgPool,
    ownership_id: &str,
) -> anyhow::Result<Vec<DealIntent>> {
    anyhow::bail!("css deal list_intents_for_ownership is not wired yet for {ownership_id}")
}

pub async fn get_intent(_pool: &sqlx::PgPool, intent_id: &str) -> anyhow::Result<DealIntent> {
    anyhow::bail!("css deal get_intent is not wired yet for {intent_id}")
}

pub async fn mark_intent_selected(_pool: &sqlx::PgPool, _intent_id: &str) -> anyhow::Result<()> {
    anyhow::bail!("css deal mark_intent_selected is not wired yet")
}

pub async fn mark_other_intents_rejected(
    _pool: &sqlx::PgPool,
    _ownership_id: &str,
    _selected_intent_id: &str,
) -> anyhow::Result<()> {
    anyhow::bail!("css deal mark_other_intents_rejected is not wired yet")
}

pub async fn insert_deal(_pool: &sqlx::PgPool, _deal: &CssDeal) -> anyhow::Result<()> {
    anyhow::bail!("css deal insert_deal is not wired yet")
}

pub async fn get_deal(_pool: &sqlx::PgPool, deal_id: &str) -> anyhow::Result<CssDeal> {
    anyhow::bail!("css deal get_deal is not wired yet for {deal_id}")
}

pub async fn mark_deal_awaiting_payment(
    _pool: &sqlx::PgPool,
    _deal_id: &str,
) -> anyhow::Result<()> {
    anyhow::bail!("css deal mark_deal_awaiting_payment is not wired yet")
}

pub async fn mark_deal_paid(
    _pool: &sqlx::PgPool,
    _deal_id: &str,
    _payment_id: &str,
) -> anyhow::Result<()> {
    anyhow::bail!("css deal mark_deal_paid is not wired yet")
}

pub async fn mark_deal_completed(_pool: &sqlx::PgPool, _deal_id: &str) -> anyhow::Result<()> {
    anyhow::bail!("css deal mark_deal_completed is not wired yet")
}
