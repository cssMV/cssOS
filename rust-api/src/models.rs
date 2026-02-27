use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub display_name: Option<String>,
    pub email: Option<String>,
    pub avatar_url: Option<String>,
    pub locale: String,
    pub role: String,
    pub profile_json: Value,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct Session {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub revoked_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub ip: Option<String>,
    pub user_agent: Option<String>,
    pub data: Value,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct BillingAccount {
    pub user_id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub currency: String,
    pub balance_cents: i64,
    pub monthly_limit_cents: i64,
    pub month_key: String,
    pub month_spend_cents: i64,
    pub auto_recharge_enabled: bool,
    pub auto_recharge_threshold_cents: i64,
    pub auto_recharge_amount_cents: i64,
    pub has_payment_method: bool,
    pub payment_meta: Value,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct UsageEvent {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub user_id: Option<Uuid>,
    pub api_key_id: Option<Uuid>,
    pub route: String,
    pub units: i64,
    pub unit_price_cents: i64,
    pub cost_cents: i64,
    pub allowed: bool,
    pub blocked_reason: Option<String>,
    pub request_id: Option<String>,
    pub meta: Value,
}

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct LedgerEntry {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub user_id: Option<Uuid>,
    pub r#type: String,
    pub amount_cents: i64,
    pub balance_after_cents: i64,
    pub currency: String,
    pub ref_usage_event_id: Option<Uuid>,
    pub note: Option<String>,
    pub meta: Value,
}
