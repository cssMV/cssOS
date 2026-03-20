use crate::css_case_delivery_signals_snapshot::types::{
    CssCaseDeliverySignalsSnapshotLogicalRecord, CssCaseDeliverySignalsSnapshotRecord,
    DeliverySignalsSnapshotReason, DeliverySignalsSnapshotSubjectKind,
};
use sqlx::Row;

pub const CREATE_CSS_CASE_DELIVERY_SIGNALS_SNAPSHOTS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_case_delivery_signals_snapshots (
    signals_snapshot_id TEXT PRIMARY KEY,
    subject_kind TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    snapshot_key_hash TEXT NOT NULL,
    snapshot_key_json JSONB NOT NULL,
    reason TEXT NOT NULL,
    signals_json JSONB NOT NULL,
    payload_json JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL
)
"#;

pub async fn insert_delivery_signals_snapshot(
    pool: &sqlx::PgPool,
    record: &CssCaseDeliverySignalsSnapshotRecord,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_case_delivery_signals_snapshots (
            signals_snapshot_id,
            subject_kind,
            subject_key,
            snapshot_key_hash,
            snapshot_key_json,
            reason,
            signals_json,
            payload_json,
            created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        "#,
    )
    .bind(&record.signals_snapshot_id)
    .bind(subject_kind_to_db(&record.subject_kind))
    .bind(&record.subject_key)
    .bind(&record.snapshot_key_hash)
    .bind(&record.snapshot_key_json)
    .bind(reason_to_db(&record.reason))
    .bind(&record.signals_json)
    .bind(&record.payload_json)
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn insert_signals_snapshot(
    pool: &sqlx::PgPool,
    record: &CssCaseDeliverySignalsSnapshotRecord,
) -> anyhow::Result<()> {
    insert_delivery_signals_snapshot(pool, record).await
}

pub async fn get_delivery_signals_snapshot(
    pool: &sqlx::PgPool,
    snapshot_id: &str,
) -> anyhow::Result<Option<CssCaseDeliverySignalsSnapshotRecord>> {
    let row = sqlx::query(
        r#"
        SELECT
            signals_snapshot_id,
            subject_kind,
            subject_key,
            snapshot_key_hash,
            snapshot_key_json,
            reason,
            signals_json,
            payload_json,
            created_at::text AS created_at
        FROM css_case_delivery_signals_snapshots
        WHERE signals_snapshot_id = $1
        "#,
    )
    .bind(snapshot_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_signals_snapshot).transpose()
}

pub async fn get_signals_snapshot(
    pool: &sqlx::PgPool,
    snapshot_id: &str,
) -> anyhow::Result<Option<CssCaseDeliverySignalsSnapshotRecord>> {
    get_delivery_signals_snapshot(pool, snapshot_id).await
}

pub async fn list_delivery_signals_snapshots(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssCaseDeliverySignalsSnapshotLogicalRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT
            signals_snapshot_id,
            subject_kind,
            subject_key,
            snapshot_key_hash,
            snapshot_key_json,
            reason,
            signals_json,
            payload_json,
            created_at::text AS created_at
        FROM css_case_delivery_signals_snapshots
        ORDER BY created_at DESC, signals_snapshot_id DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(row_to_signals_snapshot)
        .map(|result| result.and_then(logical_record_from_raw))
        .collect()
}

pub async fn list_delivery_signals_snapshots_by_key_hash(
    pool: &sqlx::PgPool,
    key_hash: &str,
) -> anyhow::Result<Vec<CssCaseDeliverySignalsSnapshotRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT
            signals_snapshot_id,
            subject_kind,
            subject_key,
            snapshot_key_hash,
            snapshot_key_json,
            reason,
            signals_json,
            payload_json,
            created_at::text AS created_at
        FROM css_case_delivery_signals_snapshots
        WHERE snapshot_key_hash = $1
        ORDER BY created_at DESC, signals_snapshot_id DESC
        "#,
    )
    .bind(key_hash)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_signals_snapshot).collect()
}

pub async fn list_signals_snapshots_for_subject(
    pool: &sqlx::PgPool,
    subject_key: &str,
) -> anyhow::Result<Vec<CssCaseDeliverySignalsSnapshotRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT
            signals_snapshot_id,
            subject_kind,
            subject_key,
            snapshot_key_hash,
            snapshot_key_json,
            reason,
            signals_json,
            payload_json,
            created_at::text AS created_at
        FROM css_case_delivery_signals_snapshots
        WHERE subject_key = $1
        ORDER BY created_at DESC, signals_snapshot_id DESC
        "#,
    )
    .bind(subject_key)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_signals_snapshot).collect()
}

pub async fn list_delivery_signals_snapshots_for_subject(
    pool: &sqlx::PgPool,
    target: &crate::css_case_delivery_log::types::CaseDeliveryLogTarget,
    mode: &crate::css_case_delivery_log::types::CaseDeliveryLogMode,
) -> anyhow::Result<Vec<CssCaseDeliverySignalsSnapshotLogicalRecord>> {
    let subject_key = crate::css_case_delivery_signals_snapshot::runtime::subject_key(target, mode);
    let records = list_signals_snapshots_for_subject(pool, &subject_key).await?;

    records
        .into_iter()
        .map(logical_record_from_raw)
        .collect::<anyhow::Result<Vec<_>>>()
}

pub fn logical_record_from_raw(
    record: CssCaseDeliverySignalsSnapshotRecord,
) -> anyhow::Result<CssCaseDeliverySignalsSnapshotLogicalRecord> {
    crate::css_case_delivery_signals_snapshot::runtime::parse_envelope_from_raw(&record).and_then(
        |envelope| {
            Ok(CssCaseDeliverySignalsSnapshotLogicalRecord {
                signals_snapshot_id: record.signals_snapshot_id.clone(),
                snapshot_id: record.snapshot_id.clone(),
                subject: parse_subject_from_raw(&record),
                snapshot_key: record.snapshot_key,
                reason: record.reason,
                signals: envelope.signals.clone(),
                envelope,
                created_at: record.created_at,
            })
        },
    )
}

fn row_to_signals_snapshot(
    row: sqlx::postgres::PgRow,
) -> anyhow::Result<CssCaseDeliverySignalsSnapshotRecord> {
    let signals_snapshot_id: String = row.try_get("signals_snapshot_id")?;
    let snapshot_key_json: serde_json::Value = row.try_get("snapshot_key_json")?;

    Ok(CssCaseDeliverySignalsSnapshotRecord {
        signals_snapshot_id: signals_snapshot_id.clone(),
        snapshot_id: signals_snapshot_id,
        subject_kind: subject_kind_from_db(&row.try_get::<String, _>("subject_kind")?)?,
        subject_key: row.try_get("subject_key")?,
        snapshot_key_hash: row.try_get("snapshot_key_hash")?,
        snapshot_key: serde_json::from_value(snapshot_key_json.clone())?,
        snapshot_key_json,
        reason: reason_from_db(&row.try_get::<String, _>("reason")?)?,
        signals_json: row.try_get("signals_json")?,
        payload_json: row.try_get("payload_json")?,
        created_at: row.try_get("created_at")?,
    })
}

fn parse_subject_from_raw(
    record: &CssCaseDeliverySignalsSnapshotRecord,
) -> Option<crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotSubject> {
    let parts = record.subject_key.split(':').collect::<Vec<_>>();
    if parts.len() != 3 {
        return None;
    }

    let target = match parts[1] {
        "reportbundle" | "report_bundle" => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::ReportBundle
        }
        "dashboard" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Dashboard,
        "kpi" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Kpi,
        "analytics" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Analytics,
        "trends" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Trends,
        "alerts" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Alerts,
        "digest" => crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Digest,
        "briefingpack" | "briefing_pack" | "briefing" => {
            crate::css_case_delivery_log::types::CaseDeliveryLogTarget::Briefing
        }
        _ => return None,
    };

    let mode = match parts[2] {
        "download" => crate::css_case_delivery_log::types::CaseDeliveryLogMode::Download,
        "attachment" => crate::css_case_delivery_log::types::CaseDeliveryLogMode::Attachment,
        "robotpull" | "robot_pull" => {
            crate::css_case_delivery_log::types::CaseDeliveryLogMode::RobotPull
        }
        "apibundle" | "api_bundle" => {
            crate::css_case_delivery_log::types::CaseDeliveryLogMode::ApiBundle
        }
        _ => return None,
    };

    Some(
        crate::css_case_delivery_signals_snapshot::types::DeliverySignalsSnapshotSubject {
            target,
            mode,
        },
    )
}

fn subject_kind_to_db(kind: &DeliverySignalsSnapshotSubjectKind) -> &'static str {
    match kind {
        DeliverySignalsSnapshotSubjectKind::DeliveryObject => "delivery_object",
    }
}

fn subject_kind_from_db(value: &str) -> anyhow::Result<DeliverySignalsSnapshotSubjectKind> {
    match value {
        "delivery_object" => Ok(DeliverySignalsSnapshotSubjectKind::DeliveryObject),
        other => anyhow::bail!("unknown delivery signals snapshot subject kind: {other}"),
    }
}

fn reason_to_db(reason: &DeliverySignalsSnapshotReason) -> &'static str {
    match reason {
        DeliverySignalsSnapshotReason::DeliveryDecision => "delivery_decision",
        DeliverySignalsSnapshotReason::GovernanceAction => "governance_action",
        DeliverySignalsSnapshotReason::RecoveryBefore => "recovery_before",
        DeliverySignalsSnapshotReason::RecoveryAfter => "recovery_after",
        DeliverySignalsSnapshotReason::ManualCapture => "manual_capture",
        DeliverySignalsSnapshotReason::RetryBefore => "retry_before",
        DeliverySignalsSnapshotReason::RetryAfter => "retry_after",
        DeliverySignalsSnapshotReason::RecoveryReview => "recovery_review",
    }
}

fn reason_from_db(value: &str) -> anyhow::Result<DeliverySignalsSnapshotReason> {
    match value {
        "delivery_decision" => Ok(DeliverySignalsSnapshotReason::DeliveryDecision),
        "governance_action" => Ok(DeliverySignalsSnapshotReason::GovernanceAction),
        "recovery_before" => Ok(DeliverySignalsSnapshotReason::RecoveryBefore),
        "recovery_after" => Ok(DeliverySignalsSnapshotReason::RecoveryAfter),
        "manual_capture" => Ok(DeliverySignalsSnapshotReason::ManualCapture),
        "retry_before" => Ok(DeliverySignalsSnapshotReason::RetryBefore),
        "retry_after" => Ok(DeliverySignalsSnapshotReason::RetryAfter),
        "recovery_review" => Ok(DeliverySignalsSnapshotReason::RecoveryReview),
        other => anyhow::bail!("unknown delivery signals snapshot reason: {other}"),
    }
}
