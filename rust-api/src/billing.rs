use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::models::{BillingAccount, UsageEvent};

#[derive(Debug, serde::Serialize)]
pub struct MeterResult {
    pub allowed: bool,
    pub balance_cents: i64,
    pub month_spend_cents: i64,
    pub monthly_limit_cents: i64,
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
