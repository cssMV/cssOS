use crate::css_dispute_engine::types::{
    CssDisputeCase, DisputeKind, DisputeSeverity, DisputeStatus,
};
use sqlx::Row;

pub const CREATE_CSS_DISPUTES_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_disputes (
    dispute_id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    severity TEXT NOT NULL,
    status TEXT NOT NULL,
    catalog_id TEXT,
    ownership_id TEXT,
    deal_id TEXT,
    user_id TEXT,
    message TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT now()
)
"#;

pub async fn insert_dispute_case(pool: &sqlx::PgPool, case: &CssDisputeCase) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_disputes (
            dispute_id,
            kind,
            severity,
            status,
            catalog_id,
            ownership_id,
            deal_id,
            user_id,
            message,
            created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        "#,
    )
    .bind(&case.dispute_id)
    .bind(dispute_kind_to_db(&case.kind))
    .bind(dispute_severity_to_db(&case.severity))
    .bind(dispute_status_to_db(&case.status))
    .bind(&case.catalog_id)
    .bind(&case.ownership_id)
    .bind(&case.deal_id)
    .bind(&case.user_id)
    .bind(&case.message)
    .bind(&case.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_open_disputes_for_catalog(
    pool: &sqlx::PgPool,
    catalog_id: &str,
) -> anyhow::Result<Vec<CssDisputeCase>> {
    let rows = sqlx::query(
        r#"
        SELECT dispute_id, kind, severity, status, catalog_id, ownership_id, deal_id, user_id, message, created_at
        FROM css_disputes
        WHERE catalog_id = $1
          AND status IN ('open', 'frozen')
        ORDER BY created_at DESC
        "#,
    )
    .bind(catalog_id)
    .fetch_all(pool)
    .await?;
    rows_to_cases(rows)
}

pub async fn list_open_disputes_for_deal(
    pool: &sqlx::PgPool,
    deal_id: &str,
) -> anyhow::Result<Vec<CssDisputeCase>> {
    let rows = sqlx::query(
        r#"
        SELECT dispute_id, kind, severity, status, catalog_id, ownership_id, deal_id, user_id, message, created_at
        FROM css_disputes
        WHERE deal_id = $1
          AND status IN ('open', 'frozen')
        ORDER BY created_at DESC
        "#,
    )
    .bind(deal_id)
    .fetch_all(pool)
    .await?;
    rows_to_cases(rows)
}

pub async fn list_open_disputes_for_user(
    pool: &sqlx::PgPool,
    user_id: &str,
) -> anyhow::Result<Vec<CssDisputeCase>> {
    let rows = sqlx::query(
        r#"
        SELECT dispute_id, kind, severity, status, catalog_id, ownership_id, deal_id, user_id, message, created_at::text AS created_at
        FROM css_disputes
        WHERE user_id = $1
          AND status IN ('open', 'frozen')
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;
    rows_to_cases(rows)
}

pub async fn mark_dispute_frozen(pool: &sqlx::PgPool, dispute_id: &str) -> anyhow::Result<()> {
    sqlx::query("UPDATE css_disputes SET status = 'frozen' WHERE dispute_id = $1")
        .bind(dispute_id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn mark_dispute_resolved(pool: &sqlx::PgPool, dispute_id: &str) -> anyhow::Result<()> {
    sqlx::query("UPDATE css_disputes SET status = 'resolved' WHERE dispute_id = $1")
        .bind(dispute_id)
        .execute(pool)
        .await?;
    Ok(())
}

fn dispute_kind_to_db(kind: &DisputeKind) -> &'static str {
    match kind {
        DisputeKind::SelfBidding => "self_bidding",
        DisputeKind::SelfAutoBidding => "self_auto_bidding",
        DisputeKind::AuctionFinalizationConflict => "auction_finalization_conflict",
        DisputeKind::BidOrderConflict => "bid_order_conflict",
        DisputeKind::OwnershipTransferConflict => "ownership_transfer_conflict",
        DisputeKind::EntitlementConflict => "entitlement_conflict",
        DisputeKind::SuspiciousPriceManipulation => "suspicious_price_manipulation",
    }
}

fn dispute_severity_to_db(severity: &DisputeSeverity) -> &'static str {
    match severity {
        DisputeSeverity::Info => "info",
        DisputeSeverity::Warning => "warning",
        DisputeSeverity::High => "high",
        DisputeSeverity::Critical => "critical",
    }
}

fn dispute_status_to_db(status: &DisputeStatus) -> &'static str {
    match status {
        DisputeStatus::Open => "open",
        DisputeStatus::Frozen => "frozen",
        DisputeStatus::Resolved => "resolved",
        DisputeStatus::Rejected => "rejected",
    }
}

fn dispute_kind_from_db(value: &str) -> anyhow::Result<DisputeKind> {
    match value {
        "self_bidding" => Ok(DisputeKind::SelfBidding),
        "self_auto_bidding" => Ok(DisputeKind::SelfAutoBidding),
        "auction_finalization_conflict" => Ok(DisputeKind::AuctionFinalizationConflict),
        "bid_order_conflict" => Ok(DisputeKind::BidOrderConflict),
        "ownership_transfer_conflict" => Ok(DisputeKind::OwnershipTransferConflict),
        "entitlement_conflict" => Ok(DisputeKind::EntitlementConflict),
        "suspicious_price_manipulation" => Ok(DisputeKind::SuspiciousPriceManipulation),
        other => anyhow::bail!("unknown css dispute kind: {other}"),
    }
}

fn dispute_severity_from_db(value: &str) -> anyhow::Result<DisputeSeverity> {
    match value {
        "info" => Ok(DisputeSeverity::Info),
        "warning" => Ok(DisputeSeverity::Warning),
        "high" => Ok(DisputeSeverity::High),
        "critical" => Ok(DisputeSeverity::Critical),
        other => anyhow::bail!("unknown css dispute severity: {other}"),
    }
}

fn dispute_status_from_db(value: &str) -> anyhow::Result<DisputeStatus> {
    match value {
        "open" => Ok(DisputeStatus::Open),
        "frozen" => Ok(DisputeStatus::Frozen),
        "resolved" => Ok(DisputeStatus::Resolved),
        "rejected" => Ok(DisputeStatus::Rejected),
        other => anyhow::bail!("unknown css dispute status: {other}"),
    }
}

fn row_to_case(row: sqlx::postgres::PgRow) -> anyhow::Result<CssDisputeCase> {
    Ok(CssDisputeCase {
        dispute_id: row.try_get("dispute_id")?,
        kind: dispute_kind_from_db(&row.try_get::<String, _>("kind")?)?,
        severity: dispute_severity_from_db(&row.try_get::<String, _>("severity")?)?,
        status: dispute_status_from_db(&row.try_get::<String, _>("status")?)?,
        catalog_id: row.try_get("catalog_id")?,
        ownership_id: row.try_get("ownership_id")?,
        deal_id: row.try_get("deal_id")?,
        user_id: row.try_get("user_id")?,
        message: row.try_get("message")?,
        created_at: row.try_get("created_at")?,
    })
}

fn rows_to_cases(rows: Vec<sqlx::postgres::PgRow>) -> anyhow::Result<Vec<CssDisputeCase>> {
    rows.into_iter().map(row_to_case).collect()
}
