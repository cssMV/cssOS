use chrono::{Duration, Utc};
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{BillingAccount, BillingFundHold, UsageEvent};

#[derive(Debug, serde::Serialize)]
pub struct MeterResult {
    pub allowed: bool,
    pub balance_cents: i64,
    pub month_spend_cents: i64,
    pub monthly_limit_cents: i64,
}

#[derive(Debug, Clone, Copy, serde::Serialize)]
pub struct MembershipTierPlan {
    pub tier: &'static str,
    pub price_cents: i64,
    pub monthly_limit_cents: i64,
    /// CSSOS_PHASE2_TIER_DURATION_CAP 20260430 #209 — Jing
    /// Hard ceiling on per-song length in seconds. The MV pipeline + Suno
    /// adapter clamp `target_duration_secs` to this value so a Free user
    /// can never request a 10-minute song. Free 4 / Starter 5 / Pro 6 /
    /// Studio 8 / Enterprise 10 minutes (vip + admin = 10 too).
    pub max_song_duration_secs: u32,
}

#[derive(Debug, serde::Serialize)]
pub struct MembershipChangeResult {
    pub previous_tier: String,
    pub tier: String,
    pub balance_cents: i64,
    pub pending_balance_cents: i64,
    pub monthly_limit_cents: i64,
    pub charged_cents: i64,
    pub refunded_cents: i64,
    pub net_amount_cents: i64,
    pub hold_release_at: Option<chrono::DateTime<Utc>>,
}

#[derive(Debug)]
pub enum MembershipChangeError {
    InvalidTier,
    ForbiddenTier,
    InsufficientBalance {
        required_cents: i64,
        balance_cents: i64,
    },
    Sql(sqlx::Error),
}

impl From<sqlx::Error> for MembershipChangeError {
    fn from(value: sqlx::Error) -> Self {
        Self::Sql(value)
    }
}

pub fn normalize_membership_tier(raw: &str) -> &'static str {
    match raw.trim().to_ascii_lowercase().as_str() {
        "free" => "free",
        "starter" => "starter",
        "pro" => "pro",
        "studio" => "studio",
        "enterprise" => "enterprise",
        "vip" => "vip",
        "admin" => "admin",
        _ => "guest",
    }
}

pub fn self_serve_membership_plan(tier: &str) -> Option<MembershipTierPlan> {
    match normalize_membership_tier(tier) {
        "free" => Some(MembershipTierPlan {
            tier: "free",
            price_cents: 0,
            monthly_limit_cents: 0,
            max_song_duration_secs: 4 * 60,
        }),
        "starter" => Some(MembershipTierPlan {
            tier: "starter",
            price_cents: 1500,
            monthly_limit_cents: 3000,
            max_song_duration_secs: 5 * 60,
        }),
        "pro" => Some(MembershipTierPlan {
            tier: "pro",
            price_cents: 3900,
            monthly_limit_cents: 10000,
            max_song_duration_secs: 6 * 60,
        }),
        "studio" => Some(MembershipTierPlan {
            tier: "studio",
            price_cents: 12900,
            monthly_limit_cents: 30000,
            max_song_duration_secs: 8 * 60,
        }),
        "enterprise" => Some(MembershipTierPlan {
            tier: "enterprise",
            price_cents: 39900,
            monthly_limit_cents: 100000,
            max_song_duration_secs: 10 * 60,
        }),
        _ => None,
    }
}

/// CSSOS_PHASE2_TIER_DURATION_CAP 20260430 #209 — Jing
/// Resolve the maximum song duration (in seconds) for a tier string.
/// Falls back to 4 minutes (Free tier) for unknown / guest input. VIP
/// and Admin both get the Enterprise cap (10 min) since both are
/// non-self-serve internal grants and shouldn't be more restrictive
/// than the highest paid plan.
pub fn max_song_duration_secs_for_tier(tier: &str) -> u32 {
    match normalize_membership_tier(tier) {
        "free" => 4 * 60,
        "starter" => 5 * 60,
        "pro" => 6 * 60,
        "studio" => 8 * 60,
        "enterprise" | "vip" | "admin" => 10 * 60,
        _ => 4 * 60,
    }
}

pub async fn release_matured_fund_holds(pool: &PgPool, user_id: Uuid) -> Result<i64, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let mut account = sqlx::query_as::<_, BillingAccount>(
        "SELECT * FROM billing_accounts WHERE user_id = $1 FOR UPDATE",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    if account.is_none() {
        account = Some(
            sqlx::query_as::<_, BillingAccount>(
                "INSERT INTO billing_accounts (user_id) VALUES ($1) RETURNING *",
            )
            .bind(user_id)
            .fetch_one(&mut *tx)
            .await?,
        );
    }

    let account = account.expect("account");
    let pending_rows = sqlx::query_as::<_, BillingFundHold>(
        r#"
        SELECT *
          FROM billing_fund_holds
         WHERE user_id = $1
           AND status = 'pending'
           AND available_at <= now()
         ORDER BY available_at ASC, created_at ASC
        "#,
    )
    .bind(user_id)
    .fetch_all(&mut *tx)
    .await?;

    if pending_rows.is_empty() {
        tx.commit().await?;
        return Ok(account.balance_cents);
    }

    let release_total = pending_rows.iter().map(|row| row.amount_cents).sum::<i64>();
    let new_balance = account.balance_cents + release_total;

    sqlx::query(
        "UPDATE billing_accounts SET balance_cents = $2, updated_at = now() WHERE user_id = $1",
    )
    .bind(user_id)
    .bind(new_balance)
    .execute(&mut *tx)
    .await?;

    for row in pending_rows {
        sqlx::query(
            r#"
            UPDATE billing_fund_holds
               SET status = 'released',
                   released_at = now(),
                   updated_at = now()
             WHERE id = $1
            "#,
        )
        .bind(row.id)
        .execute(&mut *tx)
        .await?;

        sqlx::query(
            "INSERT INTO ledger_entries (user_id, type, amount_cents, balance_after_cents, currency, note, meta) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        )
        .bind(user_id)
        .bind("fund_hold_release")
        .bind(row.amount_cents)
        .bind(new_balance)
        .bind(&row.currency)
        .bind(row.note.clone().unwrap_or_else(|| "held funds released".to_string()))
        .bind(serde_json::json!({
            "kind": row.kind,
            "fund_hold_id": row.id,
            "available_at": row.available_at,
            "released_at": Utc::now(),
        }))
        .execute(&mut *tx)
        .await?;
    }

    tx.commit().await?;
    Ok(new_balance)
}

pub async fn pending_fund_hold_summary(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<(i64, Option<chrono::DateTime<Utc>>, Vec<BillingFundHold>), sqlx::Error> {
    let rows = sqlx::query_as::<_, BillingFundHold>(
        r#"
        SELECT *
          FROM billing_fund_holds
         WHERE user_id = $1
           AND status = 'pending'
         ORDER BY available_at ASC, created_at DESC
         LIMIT 10
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    let pending_total = rows.iter().map(|row| row.amount_cents).sum::<i64>();
    let next_available_at = rows.iter().map(|row| row.available_at).min();
    Ok((pending_total, next_available_at, rows))
}

pub async fn ensure_account(
    pool: &PgPool,
    user_id: Uuid,
) -> Result<(BillingAccount, bool), sqlx::Error> {
    let account =
        sqlx::query_as::<_, BillingAccount>("SELECT * FROM billing_accounts WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await?;

    if let Some(account) = account {
        return Ok((account, false));
    }

    let account = sqlx::query_as::<_, BillingAccount>(
        "INSERT INTO billing_accounts (user_id) VALUES ($1) RETURNING *",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await?;

    Ok((account, true))
}

pub async fn reset_month(pool: &PgPool, user_id: Uuid) -> Result<(), sqlx::Error> {
    let month_key = Utc::now().format("%Y-%m").to_string();
    sqlx::query(
        "UPDATE billing_accounts SET month_key = $2, month_spend_cents = 0, updated_at = now() WHERE user_id = $1 AND month_key <> $2",
    )
    .bind(user_id)
    .bind(month_key)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn meter_usage(
    pool: &PgPool,
    user_id: Uuid,
    route: &str,
    units: i64,
    unit_price_cents: i64,
    request_id: Option<String>,
    meta: serde_json::Value,
) -> Result<MeterResult, sqlx::Error> {
    let cost = units * unit_price_cents;
    let mut tx = pool.begin().await?;

    let mut account = sqlx::query_as::<_, BillingAccount>(
        "SELECT * FROM billing_accounts WHERE user_id = $1 FOR UPDATE",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    if account.is_none() {
        account = Some(
            sqlx::query_as::<_, BillingAccount>(
                "INSERT INTO billing_accounts (user_id) VALUES ($1) RETURNING *",
            )
            .bind(user_id)
            .fetch_one(&mut *tx)
            .await?,
        );
    }

    let mut account = account.expect("account");
    let current_month = Utc::now().format("%Y-%m").to_string();
    if account.month_key != current_month {
        account.month_key = current_month.clone();
        account.month_spend_cents = 0;
        sqlx::query(
            "UPDATE billing_accounts SET month_key = $2, month_spend_cents = 0 WHERE user_id = $1",
        )
        .bind(user_id)
        .bind(current_month)
        .execute(&mut *tx)
        .await?;
    }

    if account.monthly_limit_cents > 0
        && account.month_spend_cents + cost > account.monthly_limit_cents
    {
        sqlx::query(
            "INSERT INTO usage_events (user_id, route, units, unit_price_cents, cost_cents, allowed, blocked_reason, request_id, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        )
        .bind(user_id)
        .bind(route)
        .bind(units)
        .bind(unit_price_cents)
        .bind(cost)
        .bind(false)
        .bind("monthly_limit")
        .bind(request_id)
        .bind(meta.clone())
        .execute(&mut *tx)
        .await?;
        tx.commit().await?;
        return Ok(MeterResult {
            allowed: false,
            balance_cents: account.balance_cents,
            month_spend_cents: account.month_spend_cents,
            monthly_limit_cents: account.monthly_limit_cents,
        });
    }

    if account.balance_cents < cost {
        if account.auto_recharge_enabled
            && account.has_payment_method
            && account.auto_recharge_amount_cents > 0
        {
            let new_balance = account.balance_cents + account.auto_recharge_amount_cents;
            sqlx::query(
                "INSERT INTO ledger_entries (user_id, type, amount_cents, balance_after_cents, currency, note, meta) VALUES ($1,$2,$3,$4,$5,$6,$7)",
            )
            .bind(user_id)
            .bind("credit")
            .bind(account.auto_recharge_amount_cents)
            .bind(new_balance)
            .bind(&account.currency)
            .bind("auto_recharge_simulated")
            .bind(meta.clone())
            .execute(&mut *tx)
            .await?;
            account.balance_cents = new_balance;
            sqlx::query("UPDATE billing_accounts SET balance_cents = $2 WHERE user_id = $1")
                .bind(user_id)
                .bind(new_balance)
                .execute(&mut *tx)
                .await?;
        } else {
            sqlx::query(
                "INSERT INTO usage_events (user_id, route, units, unit_price_cents, cost_cents, allowed, blocked_reason, request_id, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
            )
            .bind(user_id)
            .bind(route)
            .bind(units)
            .bind(unit_price_cents)
            .bind(cost)
            .bind(false)
            .bind("insufficient_balance")
            .bind(request_id)
            .bind(meta.clone())
            .execute(&mut *tx)
            .await?;
            tx.commit().await?;
            return Ok(MeterResult {
                allowed: false,
                balance_cents: account.balance_cents,
                month_spend_cents: account.month_spend_cents,
                monthly_limit_cents: account.monthly_limit_cents,
            });
        }
    }

    let usage: UsageEvent = sqlx::query_as::<_, UsageEvent>(
        "INSERT INTO usage_events (user_id, route, units, unit_price_cents, cost_cents, allowed, request_id, meta) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *",
    )
    .bind(user_id)
    .bind(route)
    .bind(units)
    .bind(unit_price_cents)
    .bind(cost)
    .bind(true)
    .bind(request_id)
    .bind(meta.clone())
    .fetch_one(&mut *tx)
    .await?;

    let new_balance = account.balance_cents - cost;
    let new_spend = account.month_spend_cents + cost;

    sqlx::query(
        "UPDATE billing_accounts SET balance_cents = $2, month_spend_cents = $3, updated_at = now() WHERE user_id = $1",
    )
    .bind(user_id)
    .bind(new_balance)
    .bind(new_spend)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO ledger_entries (user_id, type, amount_cents, balance_after_cents, currency, ref_usage_event_id, meta) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    )
    .bind(user_id)
    .bind("debit")
    .bind(-cost)
    .bind(new_balance)
    .bind(&account.currency)
    .bind(usage.id)
    .bind(meta)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    Ok(MeterResult {
        allowed: true,
        balance_cents: new_balance,
        month_spend_cents: new_spend,
        monthly_limit_cents: account.monthly_limit_cents,
    })
}

pub async fn append_ledger_adjustment(
    pool: &PgPool,
    user_id: Uuid,
    amount_cents: i64,
    entry_type: &str,
    note: &str,
    meta: serde_json::Value,
) -> Result<i64, sqlx::Error> {
    let mut tx = pool.begin().await?;
    let mut account = sqlx::query_as::<_, BillingAccount>(
        "SELECT * FROM billing_accounts WHERE user_id = $1 FOR UPDATE",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    if account.is_none() {
        account = Some(
            sqlx::query_as::<_, BillingAccount>(
                "INSERT INTO billing_accounts (user_id) VALUES ($1) RETURNING *",
            )
            .bind(user_id)
            .fetch_one(&mut *tx)
            .await?,
        );
    }

    let account = account.expect("account");
    let new_balance = account.balance_cents + amount_cents;
    sqlx::query(
        "UPDATE billing_accounts SET balance_cents = $2, updated_at = now() WHERE user_id = $1",
    )
    .bind(user_id)
    .bind(new_balance)
    .execute(&mut *tx)
    .await?;
    sqlx::query(
        "INSERT INTO ledger_entries (user_id, type, amount_cents, balance_after_cents, currency, note, meta) VALUES ($1,$2,$3,$4,$5,$6,$7)",
    )
    .bind(user_id)
    .bind(entry_type)
    .bind(amount_cents)
    .bind(new_balance)
    .bind(&account.currency)
    .bind(note)
    .bind(meta)
    .execute(&mut *tx)
    .await?;
    tx.commit().await?;
    Ok(new_balance)
}

pub async fn change_membership_tier_with_balance(
    pool: &PgPool,
    user_id: Uuid,
    target_tier: &str,
    requested_from: &str,
) -> Result<MembershipChangeResult, MembershipChangeError> {
    let _ = release_matured_fund_holds(pool, user_id).await?;
    let normalized_target = normalize_membership_tier(target_tier);
    if normalized_target == "guest" {
        return Err(MembershipChangeError::InvalidTier);
    }
    if matches!(normalized_target, "vip" | "admin") {
        return Err(MembershipChangeError::ForbiddenTier);
    }
    let Some(target_plan) = self_serve_membership_plan(normalized_target) else {
        return Err(MembershipChangeError::InvalidTier);
    };

    let mut tx = pool.begin().await?;
    let mut account = sqlx::query_as::<_, BillingAccount>(
        "SELECT * FROM billing_accounts WHERE user_id = $1 FOR UPDATE",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?;

    if account.is_none() {
        account = Some(
            sqlx::query_as::<_, BillingAccount>(
                "INSERT INTO billing_accounts (user_id) VALUES ($1) RETURNING *",
            )
            .bind(user_id)
            .fetch_one(&mut *tx)
            .await?,
        );
    }
    let account = account.expect("account");
    let current_tier_raw = sqlx::query_scalar::<_, String>(
        "SELECT COALESCE(membership_tier, 'free') FROM billing_accounts WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(&mut *tx)
    .await?
    .unwrap_or_else(|| "free".to_string());
    let normalized_current = normalize_membership_tier(&current_tier_raw);
    let current_plan =
        self_serve_membership_plan(normalized_current).unwrap_or(MembershipTierPlan {
            tier: "free",
            price_cents: 0,
            monthly_limit_cents: 0,
            max_song_duration_secs: 4 * 60,
        });

    let delta_cents = target_plan.price_cents - current_plan.price_cents;
    if delta_cents > 0 && account.balance_cents < delta_cents {
        return Err(MembershipChangeError::InsufficientBalance {
            required_cents: delta_cents,
            balance_cents: account.balance_cents,
        });
    }

    let charged_cents = delta_cents.max(0);
    let refunded_cents = (-delta_cents).max(0);
    let immediate_balance_delta = if delta_cents > 0 { -delta_cents } else { 0 };
    let new_balance = account.balance_cents + immediate_balance_delta;
    let hold_release_at = if refunded_cents > 0 {
        Some(Utc::now() + Duration::days(14))
    } else {
        None
    };

    sqlx::query(
        r#"
        UPDATE billing_accounts
           SET membership_tier = $2,
               membership_source = 'self_serve_balance',
               membership_updated_at = now(),
               monthly_limit_cents = $3,
               balance_cents = $4,
               updated_at = now()
         WHERE user_id = $1
        "#,
    )
    .bind(user_id)
    .bind(target_plan.tier)
    .bind(target_plan.monthly_limit_cents)
    .bind(new_balance)
    .execute(&mut *tx)
    .await?;

    if delta_cents != 0 {
        let entry_type = if delta_cents > 0 {
            "membership_change_debit"
        } else {
            "membership_change_refund_pending"
        };
        let note = if delta_cents > 0 {
            format!(
                "membership upgrade {} -> {} via {}",
                current_plan.tier, target_plan.tier, requested_from
            )
        } else {
            format!(
                "membership downgrade {} -> {} via {}",
                current_plan.tier, target_plan.tier, requested_from
            )
        };
        sqlx::query(
            "INSERT INTO ledger_entries (user_id, type, amount_cents, balance_after_cents, currency, note, meta) VALUES ($1,$2,$3,$4,$5,$6,$7)",
        )
        .bind(user_id)
        .bind(entry_type)
        .bind(if delta_cents > 0 { -delta_cents } else { refunded_cents })
        .bind(new_balance)
        .bind(&account.currency)
        .bind(note)
        .bind(serde_json::json!({
            "kind": "membership_change",
            "previous_tier": current_plan.tier,
            "target_tier": target_plan.tier,
            "requested_from": requested_from,
            "charged_cents": charged_cents,
            "refunded_cents": refunded_cents,
            "refund_hold_days": if refunded_cents > 0 { 14 } else { 0 },
            "hold_release_at": hold_release_at,
        }))
        .execute(&mut *tx)
        .await?;

        if refunded_cents > 0 {
            sqlx::query(
                r#"
                INSERT INTO billing_fund_holds (
                    user_id, kind, status, amount_cents, currency, note, available_at, meta
                ) VALUES ($1,$2,'pending',$3,$4,$5,$6,$7)
                "#,
            )
            .bind(user_id)
            .bind("membership_downgrade_refund")
            .bind(refunded_cents)
            .bind(&account.currency)
            .bind(format!(
                "membership downgrade refund {} -> {}",
                current_plan.tier, target_plan.tier
            ))
            .bind(hold_release_at)
            .bind(serde_json::json!({
                "kind": "membership_change",
                "previous_tier": current_plan.tier,
                "target_tier": target_plan.tier,
                "requested_from": requested_from,
                "refunded_cents": refunded_cents,
                "hold_days": 14,
            }))
            .execute(&mut *tx)
            .await?;
        }
    }

    tx.commit().await?;

    let (pending_balance_cents, _, _) = pending_fund_hold_summary(pool, user_id).await?;

    Ok(MembershipChangeResult {
        previous_tier: current_plan.tier.to_string(),
        tier: target_plan.tier.to_string(),
        balance_cents: new_balance,
        pending_balance_cents,
        monthly_limit_cents: target_plan.monthly_limit_cents,
        charged_cents,
        refunded_cents,
        net_amount_cents: delta_cents,
        hold_release_at,
    })
}
