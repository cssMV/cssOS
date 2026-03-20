use crate::css_case_delivery_action_log::types::{
    CssCaseDeliveryActionLogRecord, DeliveryActionLogQueryRequest,
};
use crate::css_case_delivery_actions_engine::types::DeliveryActionKind;
use crate::css_case_delivery_log::types::{CaseDeliveryLogMode, CaseDeliveryLogTarget};
use sqlx::Row;

pub const CREATE_CSS_CASE_DELIVERY_ACTION_LOGS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_case_delivery_action_logs (
    action_log_id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    reason TEXT NOT NULL,
    action TEXT NOT NULL,
    action_target_hash TEXT NOT NULL,
    action_target_json JSONB NOT NULL,
    target TEXT NOT NULL,
    mode TEXT NOT NULL,
    subject_key TEXT NOT NULL,
    succeeded BOOLEAN NOT NULL,
    message TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    result_message TEXT NOT NULL,
    payload_name TEXT,
    snapshot_id TEXT,
    created_at TIMESTAMP NOT NULL
)
"#;

pub async fn insert_delivery_action_log(
    pool: &sqlx::PgPool,
    action_target_hash: &str,
    record: &CssCaseDeliveryActionLogRecord,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_case_delivery_action_logs (
            action_log_id, actor_user_id, reason, action, action_target_hash, action_target_json,
            target, mode, subject_key, succeeded, message, success, result_message,
            payload_name, snapshot_id, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
        "#,
    )
    .bind(&record.action_log_id)
    .bind(&record.actor_user_id)
    .bind(&record.reason)
    .bind(action_to_db(&record.action))
    .bind(action_target_hash)
    .bind(serde_json::to_value(&record.action_target)?)
    .bind(target_to_db(&record.target))
    .bind(mode_to_db(&record.mode))
    .bind(&record.subject_key)
    .bind(record.succeeded)
    .bind(&record.message)
    .bind(record.success)
    .bind(&record.result_message)
    .bind(&record.payload_name)
    .bind(&record.snapshot_id)
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_delivery_action_log(
    pool: &sqlx::PgPool,
    action_log_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryActionLogRecord>> {
    let row = sqlx::query(
        r#"
        SELECT action_log_id, actor_user_id, reason, action, action_target_json, target, mode,
               subject_key, succeeded, message, success, result_message, payload_name, snapshot_id,
               created_at::text AS created_at
        FROM css_case_delivery_action_logs
        WHERE action_log_id = $1
        "#,
    )
    .bind(action_log_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_action_log).transpose()
}

pub async fn list_delivery_action_logs_by_target_hash(
    pool: &sqlx::PgPool,
    action_target_hash: &str,
) -> anyhow::Result<Vec<CssCaseDeliveryActionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT action_log_id, actor_user_id, reason, action, action_target_json, target, mode,
               subject_key, succeeded, message, success, result_message, payload_name, snapshot_id,
               created_at::text AS created_at
        FROM css_case_delivery_action_logs
        WHERE action_target_hash = $1
        ORDER BY created_at DESC, action_log_id DESC
        "#,
    )
    .bind(action_target_hash)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_delivery_action_log).collect()
}

pub async fn list_delivery_action_logs_for_subject(
    pool: &sqlx::PgPool,
    subject_key: &str,
) -> anyhow::Result<Vec<CssCaseDeliveryActionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT action_log_id, actor_user_id, reason, action, action_target_json, target, mode,
               subject_key, succeeded, message, success, result_message, payload_name, snapshot_id,
               created_at::text AS created_at
        FROM css_case_delivery_action_logs
        WHERE subject_key = $1
        ORDER BY created_at DESC, action_log_id DESC
        "#,
    )
    .bind(subject_key)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_delivery_action_log).collect()
}

pub async fn list_delivery_action_logs(
    pool: &sqlx::PgPool,
    req: &DeliveryActionLogQueryRequest,
) -> anyhow::Result<Vec<CssCaseDeliveryActionLogRecord>> {
    let limit = req.limit.unwrap_or(50) as i64;
    let rows = sqlx::query(
        r#"
        SELECT action_log_id, actor_user_id, reason, action, action_target_json, target, mode,
               subject_key, succeeded, message, success, result_message, payload_name, snapshot_id,
               created_at::text AS created_at
        FROM css_case_delivery_action_logs
        ORDER BY created_at DESC, action_log_id DESC
        LIMIT $1
        "#,
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let mut logs = rows
        .into_iter()
        .map(row_to_delivery_action_log)
        .collect::<anyhow::Result<Vec<_>>>()?;

    if let Some(subject_key) = &req.subject_key {
        logs.retain(|x| &x.subject_key == subject_key);
    }
    if let Some(actor_user_id) = &req.actor_user_id {
        logs.retain(|x| &x.actor_user_id == actor_user_id);
    }
    if let Some(action) = &req.action {
        logs.retain(|x| &x.action == action);
    }
    if let Some(succeeded) = req.succeeded {
        logs.retain(|x| x.succeeded == succeeded);
    }
    if let Some(target) = &req.target {
        logs.retain(|x| &x.action_target.target == target);
    }

    Ok(logs)
}

pub async fn list_all_delivery_action_logs(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssCaseDeliveryActionLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT action_log_id, actor_user_id, reason, action, action_target_json, target, mode,
               subject_key, succeeded, message, success, result_message, payload_name, snapshot_id,
               created_at::text AS created_at
        FROM css_case_delivery_action_logs
        ORDER BY created_at ASC, action_log_id ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_delivery_action_log).collect()
}

fn action_to_db(action: &DeliveryActionKind) -> &'static str {
    match action {
        DeliveryActionKind::Retry => "retry",
        DeliveryActionKind::ForceRefreshSignals => "force_refresh_signals",
        DeliveryActionKind::CaptureSnapshot => "capture_snapshot",
        DeliveryActionKind::EscalateOps => "escalate_ops",
        DeliveryActionKind::RequireManualIntervention => "require_manual_intervention",
    }
}

fn action_from_db(value: &str) -> anyhow::Result<DeliveryActionKind> {
    match value {
        "retry" => Ok(DeliveryActionKind::Retry),
        "force_refresh_signals" => Ok(DeliveryActionKind::ForceRefreshSignals),
        "capture_snapshot" => Ok(DeliveryActionKind::CaptureSnapshot),
        "escalate_ops" => Ok(DeliveryActionKind::EscalateOps),
        "require_manual_intervention" => Ok(DeliveryActionKind::RequireManualIntervention),
        other => anyhow::bail!("unknown delivery action kind: {other}"),
    }
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

fn row_to_delivery_action_log(
    row: sqlx::postgres::PgRow,
) -> anyhow::Result<CssCaseDeliveryActionLogRecord> {
    let action_target = serde_json::from_value::<
        crate::css_case_delivery_actions_engine::types::DeliveryActionTarget,
    >(row.try_get("action_target_json")?)?;

    Ok(CssCaseDeliveryActionLogRecord {
        action_log_id: row.try_get("action_log_id")?,
        action: action_from_db(&row.try_get::<String, _>("action")?)?,
        action_target,
        succeeded: row.try_get("succeeded")?,
        message: row.try_get("message")?,
        created_at: row.try_get("created_at")?,
        actor_user_id: row.try_get("actor_user_id")?,
        reason: row.try_get("reason")?,
        target: target_from_db(&row.try_get::<String, _>("target")?)?,
        mode: mode_from_db(&row.try_get::<String, _>("mode")?)?,
        subject_key: row.try_get("subject_key")?,
        success: row.try_get("success")?,
        result_message: row.try_get("result_message")?,
        payload_name: row.try_get("payload_name")?,
        snapshot_id: row.try_get("snapshot_id")?,
    })
}
