use crate::css_case_delivery_log::types::{CaseDeliveryLogMode, CaseDeliveryLogTarget};
use crate::css_case_delivery_resolution_engine::types::DeliveryResolutionState;
use crate::css_case_delivery_resolution_log::types::{
    CssCaseDeliveryResolutionLogRecord, DeliveryResolutionLogQueryRequest,
    DeliveryResolutionTriggerKind,
};
use sqlx::Row;

pub const CREATE_CSS_CASE_DELIVERY_RESOLUTION_LOGS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_case_delivery_resolution_logs (
    resolution_log_id TEXT PRIMARY KEY,
    target TEXT NOT NULL,
    mode TEXT NOT NULL,
    state TEXT NOT NULL,
    trigger_kind TEXT,
    trigger_ref TEXT,
    reasons_json JSONB NOT NULL,
    created_at TIMESTAMP NOT NULL
)
"#;

pub const CREATE_CSS_CASE_DELIVERY_RESOLUTION_LOGS_TARGET_MODE_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_resolution_logs_target_mode
ON css_case_delivery_resolution_logs(target, mode)
"#;

pub const CREATE_CSS_CASE_DELIVERY_RESOLUTION_LOGS_STATE_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_resolution_logs_state
ON css_case_delivery_resolution_logs(state)
"#;

pub const CREATE_CSS_CASE_DELIVERY_RESOLUTION_LOGS_CREATED_AT_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_resolution_logs_created_at
ON css_case_delivery_resolution_logs(created_at)
"#;

pub async fn insert_delivery_resolution_log(
    pool: &sqlx::PgPool,
    record: &CssCaseDeliveryResolutionLogRecord,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_case_delivery_resolution_logs (
            resolution_log_id, target, mode, state, trigger_kind, trigger_ref, reasons_json, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        "#,
    )
    .bind(&record.resolution_log_id)
    .bind(target_to_db(&record.target))
    .bind(mode_to_db(&record.mode))
    .bind(state_to_db(&record.state))
    .bind(record.trigger_kind.as_ref().map(trigger_kind_to_db))
    .bind(&record.trigger_ref)
    .bind(sqlx::types::Json(&record.reasons))
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_delivery_resolution_log(
    pool: &sqlx::PgPool,
    resolution_log_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryResolutionLogRecord>> {
    let row = sqlx::query(
        r#"
        SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
               reasons_json, created_at::text AS created_at
        FROM css_case_delivery_resolution_logs
        WHERE resolution_log_id = $1
        "#,
    )
    .bind(resolution_log_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_resolution_log).transpose()
}

pub async fn list_delivery_resolution_logs(
    pool: &sqlx::PgPool,
    req: &DeliveryResolutionLogQueryRequest,
) -> anyhow::Result<Vec<CssCaseDeliveryResolutionLogRecord>> {
    let limit = req.limit.unwrap_or(50) as i64;

    let rows = match (&req.target, &req.mode, &req.state) {
        (Some(target), Some(mode), Some(state)) => {
            sqlx::query(
                r#"
                SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
                       reasons_json, created_at::text AS created_at
                FROM css_case_delivery_resolution_logs
                WHERE target = $1 AND mode = $2 AND state = $3
                ORDER BY created_at DESC, resolution_log_id DESC
                LIMIT $4
                "#,
            )
            .bind(target_to_db(target))
            .bind(mode_to_db(mode))
            .bind(state_to_db(state))
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (Some(target), Some(mode), None) => {
            sqlx::query(
                r#"
                SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
                       reasons_json, created_at::text AS created_at
                FROM css_case_delivery_resolution_logs
                WHERE target = $1 AND mode = $2
                ORDER BY created_at DESC, resolution_log_id DESC
                LIMIT $3
                "#,
            )
            .bind(target_to_db(target))
            .bind(mode_to_db(mode))
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (Some(target), None, Some(state)) => {
            sqlx::query(
                r#"
                SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
                       reasons_json, created_at::text AS created_at
                FROM css_case_delivery_resolution_logs
                WHERE target = $1 AND state = $2
                ORDER BY created_at DESC, resolution_log_id DESC
                LIMIT $3
                "#,
            )
            .bind(target_to_db(target))
            .bind(state_to_db(state))
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (None, Some(mode), Some(state)) => {
            sqlx::query(
                r#"
                SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
                       reasons_json, created_at::text AS created_at
                FROM css_case_delivery_resolution_logs
                WHERE mode = $1 AND state = $2
                ORDER BY created_at DESC, resolution_log_id DESC
                LIMIT $3
                "#,
            )
            .bind(mode_to_db(mode))
            .bind(state_to_db(state))
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (Some(target), None, None) => {
            sqlx::query(
                r#"
                SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
                       reasons_json, created_at::text AS created_at
                FROM css_case_delivery_resolution_logs
                WHERE target = $1
                ORDER BY created_at DESC, resolution_log_id DESC
                LIMIT $2
                "#,
            )
            .bind(target_to_db(target))
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (None, Some(mode), None) => {
            sqlx::query(
                r#"
                SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
                       reasons_json, created_at::text AS created_at
                FROM css_case_delivery_resolution_logs
                WHERE mode = $1
                ORDER BY created_at DESC, resolution_log_id DESC
                LIMIT $2
                "#,
            )
            .bind(mode_to_db(mode))
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (None, None, Some(state)) => {
            sqlx::query(
                r#"
                SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
                       reasons_json, created_at::text AS created_at
                FROM css_case_delivery_resolution_logs
                WHERE state = $1
                ORDER BY created_at DESC, resolution_log_id DESC
                LIMIT $2
                "#,
            )
            .bind(state_to_db(state))
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
        (None, None, None) => {
            sqlx::query(
                r#"
                SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
                       reasons_json, created_at::text AS created_at
                FROM css_case_delivery_resolution_logs
                ORDER BY created_at DESC, resolution_log_id DESC
                LIMIT $1
                "#,
            )
            .bind(limit)
            .fetch_all(pool)
            .await?
        }
    };

    rows.into_iter()
        .map(row_to_delivery_resolution_log)
        .collect()
}

pub async fn list_delivery_resolution_logs_for_subject(
    pool: &sqlx::PgPool,
    target: &CaseDeliveryLogTarget,
    mode: &CaseDeliveryLogMode,
) -> anyhow::Result<Vec<CssCaseDeliveryResolutionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
               reasons_json, created_at::text AS created_at
        FROM css_case_delivery_resolution_logs
        WHERE target = $1 AND mode = $2
        ORDER BY created_at DESC, resolution_log_id DESC
        "#,
    )
    .bind(target_to_db(target))
    .bind(mode_to_db(mode))
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(row_to_delivery_resolution_log)
        .collect()
}

pub async fn get_latest_delivery_resolution_log_for_subject(
    pool: &sqlx::PgPool,
    target: &CaseDeliveryLogTarget,
    mode: &CaseDeliveryLogMode,
) -> anyhow::Result<Option<CssCaseDeliveryResolutionLogRecord>> {
    let row = sqlx::query(
        r#"
        SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
               reasons_json, created_at::text AS created_at
        FROM css_case_delivery_resolution_logs
        WHERE target = $1 AND mode = $2
        ORDER BY created_at DESC, resolution_log_id DESC
        LIMIT 1
        "#,
    )
    .bind(target_to_db(target))
    .bind(mode_to_db(mode))
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_resolution_log).transpose()
}

pub async fn list_all_delivery_resolution_logs(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssCaseDeliveryResolutionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT resolution_log_id, target, mode, state, trigger_kind, trigger_ref,
               reasons_json, created_at::text AS created_at
        FROM css_case_delivery_resolution_logs
        ORDER BY created_at ASC, resolution_log_id ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter()
        .map(row_to_delivery_resolution_log)
        .collect()
}

fn target_to_db(target: &CaseDeliveryLogTarget) -> &'static str {
    match target {
        CaseDeliveryLogTarget::ReportBundle => "report_bundle",
        CaseDeliveryLogTarget::Digest => "digest",
        CaseDeliveryLogTarget::Briefing => "briefing",
        CaseDeliveryLogTarget::Dashboard => "dashboard",
        CaseDeliveryLogTarget::Kpi => "kpi",
        CaseDeliveryLogTarget::Analytics => "analytics",
        CaseDeliveryLogTarget::Trends => "trends",
        CaseDeliveryLogTarget::Alerts => "alerts",
    }
}

fn target_from_db(value: &str) -> anyhow::Result<CaseDeliveryLogTarget> {
    match value {
        "report_bundle" => Ok(CaseDeliveryLogTarget::ReportBundle),
        "digest" => Ok(CaseDeliveryLogTarget::Digest),
        "briefing" => Ok(CaseDeliveryLogTarget::Briefing),
        "dashboard" => Ok(CaseDeliveryLogTarget::Dashboard),
        "kpi" => Ok(CaseDeliveryLogTarget::Kpi),
        "analytics" => Ok(CaseDeliveryLogTarget::Analytics),
        "trends" => Ok(CaseDeliveryLogTarget::Trends),
        "alerts" => Ok(CaseDeliveryLogTarget::Alerts),
        other => anyhow::bail!("unknown case delivery log target: {other}"),
    }
}

fn mode_to_db(mode: &CaseDeliveryLogMode) -> &'static str {
    match mode {
        CaseDeliveryLogMode::Download => "download",
        CaseDeliveryLogMode::Attachment => "attachment",
        CaseDeliveryLogMode::RobotPull => "robot_pull",
        CaseDeliveryLogMode::ApiBundle => "api_bundle",
    }
}

fn mode_from_db(value: &str) -> anyhow::Result<CaseDeliveryLogMode> {
    match value {
        "download" => Ok(CaseDeliveryLogMode::Download),
        "attachment" => Ok(CaseDeliveryLogMode::Attachment),
        "robot_pull" => Ok(CaseDeliveryLogMode::RobotPull),
        "api_bundle" => Ok(CaseDeliveryLogMode::ApiBundle),
        other => anyhow::bail!("unknown case delivery log mode: {other}"),
    }
}

fn state_to_db(state: &DeliveryResolutionState) -> &'static str {
    match state {
        DeliveryResolutionState::Resolved => "resolved",
        DeliveryResolutionState::Stabilized => "stabilized",
        DeliveryResolutionState::Escalated => "escalated",
        DeliveryResolutionState::UnderManualIntervention => "under_manual_intervention",
        DeliveryResolutionState::MonitoringOnly => "monitoring_only",
    }
}

fn state_from_db(value: &str) -> anyhow::Result<DeliveryResolutionState> {
    match value {
        "resolved" => Ok(DeliveryResolutionState::Resolved),
        "stabilized" => Ok(DeliveryResolutionState::Stabilized),
        "escalated" => Ok(DeliveryResolutionState::Escalated),
        "under_manual_intervention" => Ok(DeliveryResolutionState::UnderManualIntervention),
        "monitoring_only" => Ok(DeliveryResolutionState::MonitoringOnly),
        other => anyhow::bail!("unknown delivery resolution state: {other}"),
    }
}

fn trigger_kind_to_db(trigger_kind: &DeliveryResolutionTriggerKind) -> &'static str {
    match trigger_kind {
        DeliveryResolutionTriggerKind::ActionDriven => "action_driven",
        DeliveryResolutionTriggerKind::TimelineDriven => "timeline_driven",
        DeliveryResolutionTriggerKind::PolicyDriven => "policy_driven",
        DeliveryResolutionTriggerKind::ManualDecision => "manual_decision",
    }
}

fn trigger_kind_from_db(value: &str) -> anyhow::Result<DeliveryResolutionTriggerKind> {
    match value {
        "action_driven" => Ok(DeliveryResolutionTriggerKind::ActionDriven),
        "timeline_driven" => Ok(DeliveryResolutionTriggerKind::TimelineDriven),
        "policy_driven" => Ok(DeliveryResolutionTriggerKind::PolicyDriven),
        "manual_decision" => Ok(DeliveryResolutionTriggerKind::ManualDecision),
        other => anyhow::bail!("unknown delivery resolution trigger kind: {other}"),
    }
}

fn row_to_delivery_resolution_log(
    row: sqlx::postgres::PgRow,
) -> anyhow::Result<CssCaseDeliveryResolutionLogRecord> {
    let reasons: sqlx::types::Json<Vec<String>> = row.try_get("reasons_json")?;

    Ok(CssCaseDeliveryResolutionLogRecord {
        resolution_log_id: row.try_get("resolution_log_id")?,
        target: target_from_db(&row.try_get::<String, _>("target")?)?,
        mode: mode_from_db(&row.try_get::<String, _>("mode")?)?,
        state: state_from_db(&row.try_get::<String, _>("state")?)?,
        trigger_kind: row
            .try_get::<Option<String>, _>("trigger_kind")?
            .map(|value| trigger_kind_from_db(&value))
            .transpose()?,
        trigger_ref: row.try_get("trigger_ref")?,
        reasons: reasons.0,
        created_at: row.try_get("created_at")?,
    })
}
