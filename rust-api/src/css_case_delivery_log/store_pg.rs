use crate::css_case_delivery_log::types::{
    CaseDeliveryLogFormat, CaseDeliveryLogMode, CaseDeliveryLogTarget, CssCaseDeliveryLogRecord,
};
use sqlx::Row;

pub const CREATE_CSS_CASE_DELIVERY_LOGS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_case_delivery_logs (
    delivery_log_id TEXT PRIMARY KEY,
    subscription_id TEXT,
    subscriber_id TEXT,
    target TEXT NOT NULL,
    format TEXT NOT NULL,
    mode TEXT NOT NULL,
    api_mode TEXT,
    delivered BOOLEAN NOT NULL,
    message TEXT NOT NULL,
    payload_name TEXT,
    created_at TIMESTAMP NOT NULL
)
"#;

pub async fn insert_delivery_log(
    pool: &sqlx::PgPool,
    record: &CssCaseDeliveryLogRecord,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_case_delivery_logs (
            delivery_log_id, subscription_id, subscriber_id, target, format, mode,
            api_mode, delivered, message, payload_name, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        "#,
    )
    .bind(&record.delivery_log_id)
    .bind(&record.subscription_id)
    .bind(&record.subscriber_id)
    .bind(target_to_db(&record.target))
    .bind(format_to_db(&record.format))
    .bind(mode_to_db(&record.mode))
    .bind(record.api_mode.as_ref().map(api_mode_to_db))
    .bind(record.delivered)
    .bind(&record.message)
    .bind(&record.payload_name)
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_delivery_log(
    pool: &sqlx::PgPool,
    delivery_log_id: &str,
) -> anyhow::Result<CssCaseDeliveryLogRecord> {
    let row = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        WHERE delivery_log_id = $1
        "#,
    )
    .bind(delivery_log_id)
    .fetch_one(pool)
    .await?;
    row_to_delivery_log(row)
}

pub async fn list_delivery_logs_for_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> anyhow::Result<Vec<CssCaseDeliveryLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        WHERE subscription_id = $1
        ORDER BY created_at DESC, delivery_log_id DESC
        "#,
    )
    .bind(subscription_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_delivery_log).collect()
}

pub async fn list_delivery_logs_for_subscriber(
    pool: &sqlx::PgPool,
    subscriber_id: &str,
) -> anyhow::Result<Vec<CssCaseDeliveryLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        WHERE subscriber_id = $1
        ORDER BY created_at DESC, delivery_log_id DESC
        "#,
    )
    .bind(subscriber_id)
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_delivery_log).collect()
}

pub async fn list_delivery_logs_by_target(
    pool: &sqlx::PgPool,
    target: &CaseDeliveryLogTarget,
) -> anyhow::Result<Vec<CssCaseDeliveryLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        WHERE target = $1
        ORDER BY created_at DESC, delivery_log_id DESC
        "#,
    )
    .bind(target_to_db(target))
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_delivery_log).collect()
}

pub async fn list_delivery_logs_for_target_mode(
    pool: &sqlx::PgPool,
    target: &CaseDeliveryLogTarget,
    mode: &CaseDeliveryLogMode,
) -> anyhow::Result<Vec<CssCaseDeliveryLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        WHERE target = $1
          AND mode = $2
        ORDER BY created_at DESC, delivery_log_id DESC
        "#,
    )
    .bind(target_to_db(target))
    .bind(mode_to_db(mode))
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_delivery_log).collect()
}

pub async fn list_all_delivery_logs(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssCaseDeliveryLogRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        ORDER BY created_at ASC, delivery_log_id ASC
        "#,
    )
    .fetch_all(pool)
    .await?;
    rows.into_iter().map(row_to_delivery_log).collect()
}

pub async fn get_latest_delivery_log_for_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    let row = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        WHERE subscription_id = $1
        ORDER BY created_at DESC, delivery_log_id DESC
        LIMIT 1
        "#,
    )
    .bind(subscription_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_log).transpose()
}

pub async fn get_latest_delivery_log_by_target(
    pool: &sqlx::PgPool,
    target: &CaseDeliveryLogTarget,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    let row = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        WHERE target = $1
        ORDER BY created_at DESC, delivery_log_id DESC
        LIMIT 1
        "#,
    )
    .bind(target_to_db(target))
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_log).transpose()
}

pub async fn get_latest_delivery_log_for_target_mode(
    pool: &sqlx::PgPool,
    target: &CaseDeliveryLogTarget,
    mode: &CaseDeliveryLogMode,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    let row = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        WHERE target = $1
          AND mode = $2
        ORDER BY created_at DESC, delivery_log_id DESC
        LIMIT 1
        "#,
    )
    .bind(target_to_db(target))
    .bind(mode_to_db(mode))
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_log).transpose()
}

pub async fn get_latest_failed_delivery_log_for_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    let row = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        WHERE subscription_id = $1
          AND delivered = false
        ORDER BY created_at DESC, delivery_log_id DESC
        LIMIT 1
        "#,
    )
    .bind(subscription_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_log).transpose()
}

pub async fn get_latest_failed_delivery_log_for_target_mode(
    pool: &sqlx::PgPool,
    target: &CaseDeliveryLogTarget,
    mode: &CaseDeliveryLogMode,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    let row = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        WHERE target = $1
          AND mode = $2
          AND delivered = false
        ORDER BY created_at DESC, delivery_log_id DESC
        LIMIT 1
        "#,
    )
    .bind(target_to_db(target))
    .bind(mode_to_db(mode))
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_log).transpose()
}

pub async fn get_latest_failed_delivery_log_by_target(
    pool: &sqlx::PgPool,
    target: &CaseDeliveryLogTarget,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    let row = sqlx::query(
        r#"
        SELECT delivery_log_id, subscription_id, subscriber_id, target, format, mode, api_mode,
               delivered, message, payload_name, created_at::text AS created_at
        FROM css_case_delivery_logs
        WHERE target = $1
          AND delivered = false
        ORDER BY created_at DESC, delivery_log_id DESC
        LIMIT 1
        "#,
    )
    .bind(target_to_db(target))
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_log).transpose()
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

fn format_to_db(format: &CaseDeliveryLogFormat) -> &'static str {
    match format {
        CaseDeliveryLogFormat::Json => "json",
        CaseDeliveryLogFormat::Csv => "csv",
        CaseDeliveryLogFormat::Text => "text",
        CaseDeliveryLogFormat::Pdf => "pdf",
        CaseDeliveryLogFormat::Docx => "docx",
    }
}

fn format_from_db(value: &str) -> anyhow::Result<CaseDeliveryLogFormat> {
    match value {
        "json" => Ok(CaseDeliveryLogFormat::Json),
        "csv" => Ok(CaseDeliveryLogFormat::Csv),
        "text" => Ok(CaseDeliveryLogFormat::Text),
        "pdf" => Ok(CaseDeliveryLogFormat::Pdf),
        "docx" => Ok(CaseDeliveryLogFormat::Docx),
        other => anyhow::bail!("unknown case delivery log format: {other}"),
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

fn api_mode_to_db(mode: &crate::css_case_delivery_api::types::DeliveryApiMode) -> &'static str {
    match mode {
        crate::css_case_delivery_api::types::DeliveryApiMode::Report => "report",
        crate::css_case_delivery_api::types::DeliveryApiMode::Export => "export",
    }
}

fn api_mode_from_db(
    value: Option<String>,
) -> anyhow::Result<Option<crate::css_case_delivery_api::types::DeliveryApiMode>> {
    match value.as_deref() {
        None => Ok(None),
        Some("report") => Ok(Some(
            crate::css_case_delivery_api::types::DeliveryApiMode::Report,
        )),
        Some("export") => Ok(Some(
            crate::css_case_delivery_api::types::DeliveryApiMode::Export,
        )),
        Some(other) => anyhow::bail!("unknown case delivery log api mode: {other}"),
    }
}

fn row_to_delivery_log(row: sqlx::postgres::PgRow) -> anyhow::Result<CssCaseDeliveryLogRecord> {
    let target = target_from_db(&row.try_get::<String, _>("target")?)?;
    let format = format_from_db(&row.try_get::<String, _>("format")?)?;
    let mode = mode_from_db(&row.try_get::<String, _>("mode")?)?;
    let api_mode = api_mode_from_db(row.try_get("api_mode")?)?
        .unwrap_or(crate::css_case_delivery_api::types::DeliveryApiMode::Export);
    let delivered: bool = row.try_get("delivered")?;
    let message: String = row.try_get("message")?;

    Ok(CssCaseDeliveryLogRecord {
        delivery_log_id: row.try_get("delivery_log_id")?,
        subscription_id: row.try_get("subscription_id")?,
        subscriber_id: row.try_get("subscriber_id")?,
        target: target.clone(),
        format: format.clone(),
        mode: mode.clone(),
        api_mode: Some(api_mode.clone()),
        delivered,
        message: message.clone(),
        payload_name: row.try_get("payload_name")?,
        delivery_mode: api_mode,
        delivery_target: match mode {
            CaseDeliveryLogMode::Download => {
                crate::css_case_delivery_api::types::DeliveryApiTarget::FrontendDownload
            }
            CaseDeliveryLogMode::Attachment => {
                crate::css_case_delivery_api::types::DeliveryApiTarget::Email
            }
            CaseDeliveryLogMode::RobotPull => {
                crate::css_case_delivery_api::types::DeliveryApiTarget::Bot
            }
            CaseDeliveryLogMode::ApiBundle => {
                crate::css_case_delivery_api::types::DeliveryApiTarget::ThirdPartyClient
            }
        },
        report_type: match target {
            CaseDeliveryLogTarget::ReportBundle | CaseDeliveryLogTarget::Briefing => {
                crate::css_case_delivery_report_api::types::DeliveryReportType::BriefingPack
            }
            CaseDeliveryLogTarget::Digest => {
                crate::css_case_delivery_report_api::types::DeliveryReportType::Digest
            }
            CaseDeliveryLogTarget::Dashboard => {
                crate::css_case_delivery_report_api::types::DeliveryReportType::Dashboard
            }
            CaseDeliveryLogTarget::Kpi => {
                crate::css_case_delivery_report_api::types::DeliveryReportType::Kpi
            }
            CaseDeliveryLogTarget::Analytics => {
                crate::css_case_delivery_report_api::types::DeliveryReportType::Analytics
            }
            CaseDeliveryLogTarget::Trends => {
                crate::css_case_delivery_report_api::types::DeliveryReportType::Trends
            }
            CaseDeliveryLogTarget::Alerts => {
                crate::css_case_delivery_report_api::types::DeliveryReportType::Alerts
            }
        },
        export_format: match format {
            CaseDeliveryLogFormat::Json => Some(
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage,
            ),
            CaseDeliveryLogFormat::Csv => {
                Some(crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Csv)
            }
            CaseDeliveryLogFormat::Text => Some(
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText,
            ),
            CaseDeliveryLogFormat::Pdf => {
                Some(crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Pdf)
            }
            CaseDeliveryLogFormat::Docx => {
                Some(crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Docx)
            }
        },
        succeeded: delivered,
        result_message: message,
        created_at: row.try_get("created_at")?,
    })
}
