use crate::css_signals_snapshot::types::{
    CssSignalsSnapshot, SnapshotPurpose, SnapshotSubjectKind,
};
use sqlx::Row;

pub const CREATE_CSS_SIGNALS_SNAPSHOTS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_signals_snapshots (
    snapshot_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    purpose TEXT NOT NULL,
    signals_bundle_json JSONB NOT NULL,
    related_audit_id TEXT,
    related_review_id TEXT,
    related_deal_id TEXT,
    related_dispute_id TEXT,
    source_system TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL
)
"#;

pub async fn insert_snapshot(
    pool: &sqlx::PgPool,
    snapshot: &CssSignalsSnapshot,
) -> anyhow::Result<()> {
    let payload = serde_json::to_value(&snapshot.signals_bundle)?;
    sqlx::query(
        r#"
        INSERT INTO css_signals_snapshots (
            snapshot_id,
            subject_kind,
            subject_id,
            purpose,
            signals_bundle_json,
            related_audit_id,
            related_review_id,
            related_deal_id,
            related_dispute_id,
            source_system,
            created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        "#,
    )
    .bind(&snapshot.snapshot_id)
    .bind(subject_kind_to_db(&snapshot.subject_kind))
    .bind(&snapshot.subject_id)
    .bind(purpose_to_db(&snapshot.purpose))
    .bind(payload)
    .bind(&snapshot.related_audit_id)
    .bind(&snapshot.related_review_id)
    .bind(&snapshot.related_deal_id)
    .bind(&snapshot.related_dispute_id)
    .bind(&snapshot.source_system)
    .bind(&snapshot.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_snapshot(
    pool: &sqlx::PgPool,
    snapshot_id: &str,
) -> anyhow::Result<CssSignalsSnapshot> {
    let row = sqlx::query(
        r#"
        SELECT
            snapshot_id,
            subject_kind,
            subject_id,
            purpose,
            signals_bundle_json,
            related_audit_id,
            related_review_id,
            related_deal_id,
            related_dispute_id,
            source_system,
            created_at::text AS created_at
        FROM css_signals_snapshots
        WHERE snapshot_id = $1
        "#,
    )
    .bind(snapshot_id)
    .fetch_one(pool)
    .await?;

    row_to_snapshot(row)
}

pub async fn list_snapshots_for_subject(
    pool: &sqlx::PgPool,
    subject_kind: &SnapshotSubjectKind,
    subject_id: &str,
) -> anyhow::Result<Vec<CssSignalsSnapshot>> {
    let rows = sqlx::query(
        r#"
        SELECT
            snapshot_id,
            subject_kind,
            subject_id,
            purpose,
            signals_bundle_json,
            related_audit_id,
            related_review_id,
            related_deal_id,
            related_dispute_id,
            source_system,
            created_at::text AS created_at
        FROM css_signals_snapshots
        WHERE subject_kind = $1 AND subject_id = $2
        ORDER BY created_at DESC
        "#,
    )
    .bind(subject_kind_to_db(subject_kind))
    .bind(subject_id)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_snapshot).collect()
}

pub async fn list_snapshots_for_audit(
    pool: &sqlx::PgPool,
    audit_id: &str,
) -> anyhow::Result<Vec<CssSignalsSnapshot>> {
    list_snapshots_by_related(pool, "related_audit_id", audit_id).await
}

pub async fn list_snapshots_for_review(
    pool: &sqlx::PgPool,
    review_id: &str,
) -> anyhow::Result<Vec<CssSignalsSnapshot>> {
    list_snapshots_by_related(pool, "related_review_id", review_id).await
}

pub async fn list_snapshots_for_deal(
    pool: &sqlx::PgPool,
    deal_id: &str,
) -> anyhow::Result<Vec<CssSignalsSnapshot>> {
    list_snapshots_by_related(pool, "related_deal_id", deal_id).await
}

async fn list_snapshots_by_related(
    pool: &sqlx::PgPool,
    field: &str,
    value: &str,
) -> anyhow::Result<Vec<CssSignalsSnapshot>> {
    let sql = format!(
        r#"
        SELECT
            snapshot_id,
            subject_kind,
            subject_id,
            purpose,
            signals_bundle_json,
            related_audit_id,
            related_review_id,
            related_deal_id,
            related_dispute_id,
            source_system,
            created_at::text AS created_at
        FROM css_signals_snapshots
        WHERE {field} = $1
        ORDER BY created_at DESC
        "#
    );

    let rows = sqlx::query(&sql).bind(value).fetch_all(pool).await?;
    rows.into_iter().map(row_to_snapshot).collect()
}

fn subject_kind_to_db(kind: &SnapshotSubjectKind) -> &'static str {
    match kind {
        SnapshotSubjectKind::User => "user",
        SnapshotSubjectKind::Catalog => "catalog",
        SnapshotSubjectKind::Deal => "deal",
        SnapshotSubjectKind::Ownership => "ownership",
    }
}

fn subject_kind_from_db(value: &str) -> anyhow::Result<SnapshotSubjectKind> {
    match value {
        "user" => Ok(SnapshotSubjectKind::User),
        "catalog" => Ok(SnapshotSubjectKind::Catalog),
        "deal" => Ok(SnapshotSubjectKind::Deal),
        "ownership" => Ok(SnapshotSubjectKind::Ownership),
        other => anyhow::bail!("unknown signals snapshot subject kind: {other}"),
    }
}

fn purpose_to_db(purpose: &SnapshotPurpose) -> &'static str {
    match purpose {
        SnapshotPurpose::TrustCheck => "trust_check",
        SnapshotPurpose::RiskCheck => "risk_check",
        SnapshotPurpose::TsDecisionInput => "ts_decision_input",
        SnapshotPurpose::ReviewOpen => "review_open",
        SnapshotPurpose::ReviewDecision => "review_decision",
        SnapshotPurpose::DealFinalize => "deal_finalize",
        SnapshotPurpose::BidSubmit => "bid_submit",
        SnapshotPurpose::OwnershipTransfer => "ownership_transfer",
        SnapshotPurpose::AuditEvidence => "audit_evidence",
        SnapshotPurpose::DisputeEvidence => "dispute_evidence",
    }
}

fn purpose_from_db(value: &str) -> anyhow::Result<SnapshotPurpose> {
    match value {
        "trust_check" => Ok(SnapshotPurpose::TrustCheck),
        "risk_check" => Ok(SnapshotPurpose::RiskCheck),
        "ts_decision_input" => Ok(SnapshotPurpose::TsDecisionInput),
        "review_open" => Ok(SnapshotPurpose::ReviewOpen),
        "review_decision" => Ok(SnapshotPurpose::ReviewDecision),
        "deal_finalize" => Ok(SnapshotPurpose::DealFinalize),
        "bid_submit" => Ok(SnapshotPurpose::BidSubmit),
        "ownership_transfer" => Ok(SnapshotPurpose::OwnershipTransfer),
        "audit_evidence" => Ok(SnapshotPurpose::AuditEvidence),
        "dispute_evidence" => Ok(SnapshotPurpose::DisputeEvidence),
        other => anyhow::bail!("unknown signals snapshot purpose: {other}"),
    }
}

fn row_to_snapshot(row: sqlx::postgres::PgRow) -> anyhow::Result<CssSignalsSnapshot> {
    Ok(CssSignalsSnapshot {
        snapshot_id: row.try_get("snapshot_id")?,
        subject_kind: subject_kind_from_db(row.try_get::<&str, _>("subject_kind")?)?,
        subject_id: row.try_get("subject_id")?,
        purpose: purpose_from_db(row.try_get::<&str, _>("purpose")?)?,
        signals_bundle: serde_json::from_value(row.try_get("signals_bundle_json")?)?,
        related_audit_id: row.try_get("related_audit_id")?,
        related_review_id: row.try_get("related_review_id")?,
        related_deal_id: row.try_get("related_deal_id")?,
        related_dispute_id: row.try_get("related_dispute_id")?,
        source_system: row.try_get("source_system")?,
        created_at: row.try_get("created_at")?,
    })
}
