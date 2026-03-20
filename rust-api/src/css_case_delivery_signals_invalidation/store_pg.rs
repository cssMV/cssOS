use crate::css_case_delivery_signals_invalidation::types::CssCaseDeliverySignalsInvalidationRecord;
use sqlx::Row;

pub const CREATE_CSS_CASE_DELIVERY_SIGNALS_INVALIDATIONS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_case_delivery_signals_invalidations (
    invalidation_id TEXT PRIMARY KEY,
    reason TEXT NOT NULL,
    scope_json JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL
)
"#;

pub async fn insert_delivery_signals_invalidation(
    pool: &sqlx::PgPool,
    record: &CssCaseDeliverySignalsInvalidationRecord,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_case_delivery_signals_invalidations (
            invalidation_id, reason, scope_json, created_at
        )
        VALUES ($1, $2, $3, $4)
        "#,
    )
    .bind(&record.invalidation_id)
    .bind(reason_to_db(&record.reason))
    .bind(serde_json::to_value(&record.scope)?)
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn list_delivery_signals_invalidations(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssCaseDeliverySignalsInvalidationRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT invalidation_id, reason, scope_json, created_at::text AS created_at
        FROM css_case_delivery_signals_invalidations
        ORDER BY created_at DESC, invalidation_id DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_record).collect()
}

pub async fn list_delivery_signals_invalidations_since(
    pool: &sqlx::PgPool,
    since_rfc3339: &str,
) -> anyhow::Result<Vec<CssCaseDeliverySignalsInvalidationRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT invalidation_id, reason, scope_json, created_at::text AS created_at
        FROM css_case_delivery_signals_invalidations
        WHERE created_at >= $1::timestamp
        ORDER BY created_at DESC, invalidation_id DESC
        "#,
    )
    .bind(since_rfc3339)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_record).collect()
}

fn reason_to_db(
    reason: &crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationReason,
) -> &'static str {
    match reason {
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationReason::DeliveryLogChanged => {
            "delivery_log_changed"
        }
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationReason::RetryResultChanged => {
            "retry_result_changed"
        }
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationReason::PolicyActiveVersionChanged => {
            "policy_active_version_changed"
        }
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationReason::GovernanceDecisionChanged => {
            "governance_decision_changed"
        }
        crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationReason::RecoveryStateChanged => {
            "recovery_state_changed"
        }
    }
}

fn reason_from_db(
    value: &str,
) -> anyhow::Result<
    crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationReason,
> {
    use crate::css_case_delivery_signals_invalidation::types::DeliverySignalsInvalidationReason;

    match value {
        "delivery_log_changed" => Ok(DeliverySignalsInvalidationReason::DeliveryLogChanged),
        "retry_result_changed" => Ok(DeliverySignalsInvalidationReason::RetryResultChanged),
        "policy_active_version_changed" => {
            Ok(DeliverySignalsInvalidationReason::PolicyActiveVersionChanged)
        }
        "governance_decision_changed" => {
            Ok(DeliverySignalsInvalidationReason::GovernanceDecisionChanged)
        }
        "recovery_state_changed" => Ok(DeliverySignalsInvalidationReason::RecoveryStateChanged),
        other => anyhow::bail!("unknown delivery signals invalidation reason: {other}"),
    }
}

fn row_to_record(
    row: sqlx::postgres::PgRow,
) -> anyhow::Result<CssCaseDeliverySignalsInvalidationRecord> {
    Ok(CssCaseDeliverySignalsInvalidationRecord {
        invalidation_id: row.try_get("invalidation_id")?,
        reason: reason_from_db(&row.try_get::<String, _>("reason")?)?,
        scope: serde_json::from_value(row.try_get("scope_json")?)?,
        created_at: row.try_get("created_at")?,
    })
}
