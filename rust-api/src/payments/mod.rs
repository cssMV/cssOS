//! NihaoPay integration (WeChat Pay / Alipay / UnionPay hosted checkout).
//!
//! Layout:
//!   mod.rs      — types, DB access helpers, settlement logic (credit balance,
//!                 change membership tier, accrue creator payout).
//!   nihaopay.rs — HTTP client against api.nihaopay.com/v1.2/transactions/*
//!                 and the MD5-based verify_sign implementation.
//!
//! The public route handlers live in src/payments_api.rs (Axum handlers need
//! to be near where routes.rs mounts them; the gateway plumbing here is
//! intentionally HTTP-framework-agnostic so it can be called from a job
//! runner, a CLI, or tests without Axum context).

pub mod nihaopay;

use chrono::{DateTime, Utc};
use rand::distributions::Alphanumeric;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::billing;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum IntentKind {
    Topup,
    Subscription,
    Purchase,
    Tip,
    // CSSOS_PHASE2_BOOST_KIND 20260419 — Creator Boost self-purchase.
    // Unlike `Purchase` it has NO target_creator_id — the buyer is the
    // beneficiary. Boost kind + quantity are carried in `note` as
    // "boost:<kind>:<quantity>" so the webhook settlement path can
    // credit the correct boost bucket without a schema change.
    Boost,
}

impl IntentKind {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Topup => "topup",
            Self::Subscription => "subscription",
            Self::Purchase => "purchase",
            Self::Tip => "tip",
            Self::Boost => "boost",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "topup" => Self::Topup,
            "subscription" => Self::Subscription,
            "purchase" => Self::Purchase,
            "tip" => Self::Tip,
            "boost" => Self::Boost,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Vendor {
    Alipay,
    Wechatpay,
    Unionpay,
}

impl Vendor {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Alipay => "alipay",
            Self::Wechatpay => "wechatpay",
            Self::Unionpay => "unionpay",
        }
    }
    pub fn parse(s: &str) -> Option<Self> {
        Some(match s {
            "alipay" => Self::Alipay,
            "wechatpay" => Self::Wechatpay,
            "unionpay" => Self::Unionpay,
            _ => return None,
        })
    }
}

#[derive(Debug, Clone, sqlx::FromRow, Serialize)]
pub struct PaymentIntent {
    pub id: Uuid,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub completed_at: Option<DateTime<Utc>>,
    pub user_id: Uuid,
    pub kind: String,
    pub amount_cents: i64,
    pub currency: String,
    pub gateway: String,
    pub vendor: String,
    pub reference: String,
    pub nihaopay_txn_id: Option<String>,
    pub status: String,
    pub target_creator_id: Option<Uuid>,
    pub target_item_id: Option<Uuid>,
    pub tier: Option<String>,
    pub note: Option<String>,
    pub metadata: serde_json::Value,
    pub raw_ipn: Option<serde_json::Value>,
}

/// Spec: reference is ≤ 30 alphanumeric chars and must be unique per merchant.
/// Prefix `css` so we can grep for our refs in the merchant dashboard; fill
/// the rest with 27 chars of base36 entropy (~140 bits, collision-safe).
pub fn generate_reference() -> String {
    let tail: String = rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(27)
        .map(char::from)
        .collect();
    format!("css{}", tail)
}

#[derive(Debug, thiserror::Error)]
pub enum PaymentError {
    #[error("db: {0}")]
    Db(#[from] sqlx::Error),
    #[error("gateway: {0}")]
    Gateway(String),
    #[error("invalid: {0}")]
    Invalid(String),
    #[error("unknown intent")]
    UnknownIntent,
    #[error("already settled")]
    AlreadySettled,
}

/// Insert a new pending payment_intent row. Caller is responsible for then
/// calling `nihaopay::create_securepay()` and returning the redirect info
/// to the browser.
#[allow(clippy::too_many_arguments)]
pub async fn create_intent(
    pool: &PgPool,
    user_id: Uuid,
    kind: IntentKind,
    amount_cents: i64,
    vendor: Vendor,
    note: Option<&str>,
    target_creator_id: Option<Uuid>,
    target_item_id: Option<Uuid>,
    tier: Option<&str>,
    metadata: serde_json::Value,
) -> Result<PaymentIntent, PaymentError> {
    if amount_cents <= 0 {
        return Err(PaymentError::Invalid("amount_cents must be > 0".into()));
    }
    // NihaoPay's own limits (see Errors 40010/40011): minimum varies by vendor
    // but in practice >= $0.01 passes a sanity check; the gateway will 40011
    // if below their vendor-specific floor.
    let reference = generate_reference();
    let row = sqlx::query_as::<_, PaymentIntent>(
        r#"INSERT INTO payment_intents
           (user_id, kind, amount_cents, vendor, reference, note,
            target_creator_id, target_item_id, tier, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *"#,
    )
    .bind(user_id)
    .bind(kind.as_str())
    .bind(amount_cents)
    .bind(vendor.as_str())
    .bind(&reference)
    .bind(note)
    .bind(target_creator_id)
    .bind(target_item_id)
    .bind(tier)
    .bind(metadata)
    .fetch_one(pool)
    .await?;
    Ok(row)
}

pub async fn get_intent(
    pool: &PgPool,
    intent_id: Uuid,
) -> Result<Option<PaymentIntent>, sqlx::Error> {
    sqlx::query_as::<_, PaymentIntent>("SELECT * FROM payment_intents WHERE id = $1")
        .bind(intent_id)
        .fetch_optional(pool)
        .await
}

pub async fn get_intent_by_reference(
    pool: &PgPool,
    reference: &str,
) -> Result<Option<PaymentIntent>, sqlx::Error> {
    sqlx::query_as::<_, PaymentIntent>("SELECT * FROM payment_intents WHERE reference = $1")
        .bind(reference)
        .fetch_optional(pool)
        .await
}

pub async fn list_intents_for_user(
    pool: &PgPool,
    user_id: Uuid,
    limit: i64,
) -> Result<Vec<PaymentIntent>, sqlx::Error> {
    sqlx::query_as::<_, PaymentIntent>(
        r#"SELECT * FROM payment_intents
           WHERE user_id = $1
           ORDER BY created_at DESC
           LIMIT $2"#,
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
}

/// Mark an intent as redirected (we handed the user off to NihaoPay's
/// SecurePay page). Does NOT credit anything.
pub async fn mark_redirected(
    pool: &PgPool,
    intent_id: Uuid,
    nihaopay_txn_id: Option<&str>,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"UPDATE payment_intents
           SET status = CASE WHEN status = 'pending' THEN 'redirected' ELSE status END,
               nihaopay_txn_id = COALESCE($2, nihaopay_txn_id),
               updated_at = now()
           WHERE id = $1"#,
    )
    .bind(intent_id)
    .bind(nihaopay_txn_id)
    .execute(pool)
    .await?;
    Ok(())
}

/// Result of settle_paid: what side-effects the IPN handler triggered so we
/// can include a useful summary in the webhook event log.
#[derive(Debug, Serialize, Clone)]
pub struct SettleOutcome {
    pub intent_id: Uuid,
    pub kind: String,
    pub credited_balance_cents: Option<i64>,
    pub tier_changed_to: Option<String>,
    pub creator_payout_id: Option<Uuid>,
    pub creator_net_cents: Option<i64>,
    pub platform_fee_cents: Option<i64>,
}

/// Settle a paid intent. Idempotent: returns Ok(None) if the intent was
/// already in a terminal state.
///
/// For `topup` / `tip` / `purchase`: credits the buyer's balance (topup) or
/// records a creator payout (tip/purchase). For `subscription`: upgrades the
/// caller's membership_tier using billing::change_membership_tier_with_balance
/// (which takes payment out of the just-credited balance — we credit then
/// immediately upgrade, so the user effectively pays directly).
pub async fn settle_paid(
    pool: &PgPool,
    intent: &PaymentIntent,
    cfg_purchase_bps: i64,
    cfg_tip_bps: i64,
) -> Result<Option<SettleOutcome>, PaymentError> {
    // Atomic claim: flip pending/redirected → settling in one statement.
    // Only the IPN that wins this race proceeds with side-effects;
    // concurrent retries see None and return Ok(None). This is belt-and-
    // suspenders for NihaoPay's (documented sequential) retry behavior, and
    // makes the tests happy under actual concurrency.
    let claimed = sqlx::query_scalar::<_, String>(
        r#"UPDATE payment_intents
           SET status = 'settling', updated_at = now()
           WHERE id = $1 AND status IN ('pending','redirected')
           RETURNING status"#,
    )
    .bind(intent.id)
    .fetch_optional(pool)
    .await?;
    if claimed.is_none() {
        // Either already settled (paid/failed/expired/refunded) or the
        // intent vanished. Either way, not our job.
        let exists = sqlx::query_scalar::<_, i64>(
            "SELECT 1 FROM payment_intents WHERE id = $1",
        )
        .bind(intent.id)
        .fetch_optional(pool)
        .await?
        .is_some();
        if !exists {
            return Err(PaymentError::UnknownIntent);
        }
        return Ok(None);
    }

    let kind = IntentKind::parse(&intent.kind)
        .ok_or_else(|| PaymentError::Invalid(format!("bad kind {}", intent.kind)))?;

    let mut out = SettleOutcome {
        intent_id: intent.id,
        kind: intent.kind.clone(),
        credited_balance_cents: None,
        tier_changed_to: None,
        creator_payout_id: None,
        creator_net_cents: None,
        platform_fee_cents: None,
    };

    match kind {
        IntentKind::Topup => {
            let new_balance = billing::append_ledger_adjustment(
                pool,
                intent.user_id,
                intent.amount_cents,
                "credit",
                &format!("nihaopay topup ({})", intent.reference),
                serde_json::json!({
                    "source": "nihaopay",
                    "intent_id": intent.id,
                    "reference": intent.reference,
                    "vendor": intent.vendor,
                }),
            )
            .await?;
            out.credited_balance_cents = Some(new_balance);
        }

        IntentKind::Subscription => {
            // Credit first (so the balance covers the upgrade), then flip tier.
            let _ = billing::append_ledger_adjustment(
                pool,
                intent.user_id,
                intent.amount_cents,
                "credit",
                &format!("nihaopay subscription payment ({})", intent.reference),
                serde_json::json!({
                    "source": "nihaopay",
                    "intent_id": intent.id,
                    "reference": intent.reference,
                    "vendor": intent.vendor,
                    "intent_kind": "subscription",
                }),
            )
            .await?;
            if let Some(tier) = intent.tier.as_deref() {
                match billing::change_membership_tier_with_balance(
                    pool,
                    intent.user_id,
                    tier,
                    "nihaopay_settlement",
                )
                .await
                {
                    Ok(res) => {
                        out.tier_changed_to = Some(res.tier);
                        out.credited_balance_cents = Some(res.balance_cents);
                    }
                    Err(e) => {
                        // Balance was credited; tier flip failed. Leave the
                        // user with their topup (safer than rolling it back)
                        // and surface the error so we can retry manually.
                        tracing::warn!(
                            intent_id = %intent.id,
                            err = ?e,
                            "payments: subscription settle credited balance but tier change failed"
                        );
                        out.credited_balance_cents = Some(intent.amount_cents);
                    }
                }
            } else {
                tracing::warn!(
                    intent_id = %intent.id,
                    "payments: subscription intent missing tier — treated as topup"
                );
                out.credited_balance_cents = Some(intent.amount_cents);
            }
        }

        IntentKind::Boost => {
            // CSSOS_PHASE2_BOOST_KIND 20260419 — Creator Boost self-purchase.
            // Note format is "boost:<kind>:<quantity>" as emitted by
            // app.payments-checkout.js / app.subscription-panel.js. Credit
            // the buyer's `account_entitlements` row for `boost.<kind>`.
            // Falls back gracefully if the note is malformed: we credit
            // the amount back to the user balance so the buyer is never
            // charged with nothing in return.
            let note = intent.note.as_deref().unwrap_or("");
            let parts: Vec<&str> = note.split(':').collect();
            let (boost_kind, qty) = match parts.as_slice() {
                ["boost", k, q] => {
                    let q: i64 = q.parse().unwrap_or(0);
                    (k.trim().to_lowercase(), q.clamp(0, 1000))
                }
                _ => (String::new(), 0),
            };
            if !boost_kind.is_empty() && qty > 0 {
                sqlx::query(
                    r#"
                    INSERT INTO account_entitlements (
                        user_id, entitlement_key, quantity, consumed_quantity,
                        source, meta
                    ) VALUES ($1, $2, $3, 0, 'nihaopay_boost_purchase', $4::jsonb)
                    "#,
                )
                .bind(intent.user_id)
                .bind(format!("boost.{boost_kind}"))
                .bind(qty)
                .bind(serde_json::json!({
                    "source": "nihaopay",
                    "intent_id": intent.id,
                    "reference": intent.reference,
                    "vendor": intent.vendor,
                    "amount_cents": intent.amount_cents,
                }))
                .execute(pool)
                .await?;
                out.credited_balance_cents = Some(0);
            } else {
                // Malformed note — refund into balance instead of
                // silently eating the charge.
                tracing::warn!(
                    intent_id = %intent.id,
                    note = %note,
                    "payments: boost intent had malformed note; crediting balance as fallback"
                );
                let new_balance = billing::append_ledger_adjustment(
                    pool,
                    intent.user_id,
                    intent.amount_cents,
                    "credit",
                    &format!("nihaopay boost fallback topup ({})", intent.reference),
                    serde_json::json!({
                        "source": "nihaopay",
                        "intent_id": intent.id,
                        "reference": intent.reference,
                        "vendor": intent.vendor,
                        "intent_kind": "boost",
                        "note": note,
                    }),
                )
                .await?;
                out.credited_balance_cents = Some(new_balance);
            }
        }

        IntentKind::Tip | IntentKind::Purchase => {
            let bps = match kind {
                IntentKind::Tip => cfg_tip_bps,
                IntentKind::Purchase => cfg_purchase_bps,
                _ => 0,
            };
            let platform_fee_cents = intent.amount_cents * bps / 10_000;
            let net_cents = intent.amount_cents - platform_fee_cents;
            let creator_id = intent.target_creator_id.ok_or_else(|| {
                PaymentError::Invalid("tip/purchase intent missing target_creator_id".into())
            })?;

            let payout_id: Uuid = sqlx::query_scalar(
                r#"INSERT INTO creator_payouts
                   (creator_id, intent_id, kind, gross_cents, platform_fee_cents, net_cents)
                   VALUES ($1, $2, $3, $4, $5, $6)
                   ON CONFLICT (intent_id) DO UPDATE
                     SET creator_id = EXCLUDED.creator_id
                   RETURNING id"#,
            )
            .bind(creator_id)
            .bind(intent.id)
            .bind(kind.as_str())
            .bind(intent.amount_cents)
            .bind(platform_fee_cents)
            .bind(net_cents)
            .fetch_one(pool)
            .await?;

            out.creator_payout_id = Some(payout_id);
            out.creator_net_cents = Some(net_cents);
            out.platform_fee_cents = Some(platform_fee_cents);
        }
    }

    sqlx::query(
        r#"UPDATE payment_intents
           SET status = 'paid', completed_at = now(), updated_at = now()
           WHERE id = $1 AND status = 'settling'"#,
    )
    .bind(intent.id)
    .execute(pool)
    .await?;

    Ok(Some(out))
}

pub async fn mark_failed(
    pool: &PgPool,
    intent_id: Uuid,
    status: &str, // "failed" | "expired"
) -> Result<(), sqlx::Error> {
    let status = if matches!(status, "expired") { "expired" } else { "failed" };
    sqlx::query(
        r#"UPDATE payment_intents
           SET status = $2, updated_at = now()
           WHERE id = $1 AND status IN ('pending','redirected','settling')"#,
    )
    .bind(intent_id)
    .bind(status)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn record_raw_ipn(
    pool: &PgPool,
    intent_id: Uuid,
    raw: &serde_json::Value,
) -> Result<(), sqlx::Error> {
    sqlx::query(
        r#"UPDATE payment_intents SET raw_ipn = $2, updated_at = now() WHERE id = $1"#,
    )
    .bind(intent_id)
    .bind(raw)
    .execute(pool)
    .await?;
    Ok(())
}
