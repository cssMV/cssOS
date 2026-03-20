use crate::css_case_delivery_api::types::{DeliveryApiMode, DeliveryApiTarget};
use crate::css_case_delivery_export_engine::types::DeliveryExportFormat;
use crate::css_case_delivery_report_api::types::DeliveryReportType;
use crate::css_case_delivery_subscription_engine::types::{
    CssCaseDeliverySubscriptionRecord, DeliverySubscriptionFrequency, DeliverySubscriptionStatus,
    DeliverySubscriptionTarget, UpdateDeliverySubscriptionRequest,
};
use sqlx::Row;

pub const CREATE_CSS_CASE_DELIVERY_SUBSCRIPTIONS_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS css_case_delivery_subscriptions (
    subscription_id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL,
    frequency TEXT NOT NULL,
    delivery_mode TEXT NOT NULL,
    delivery_target_json JSONB NOT NULL,
    report_type TEXT NOT NULL,
    export_format TEXT,
    days INTEGER,
    preview_limit INTEGER,
    created_at TIMESTAMP NOT NULL
)
"#;

pub const CREATE_CSS_CASE_DELIVERY_SUBSCRIPTIONS_USER_ID_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_subscriptions_user_id
ON css_case_delivery_subscriptions(user_id)
"#;

pub const CREATE_CSS_CASE_DELIVERY_SUBSCRIPTIONS_STATUS_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_subscriptions_status
ON css_case_delivery_subscriptions(status)
"#;

pub const CREATE_CSS_CASE_DELIVERY_SUBSCRIPTIONS_FREQUENCY_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_subscriptions_frequency
ON css_case_delivery_subscriptions(frequency)
"#;

pub const CREATE_CSS_CASE_DELIVERY_SUBSCRIPTIONS_REPORT_TYPE_INDEX_SQL: &str = r#"
CREATE INDEX IF NOT EXISTS idx_css_case_delivery_subscriptions_report_type
ON css_case_delivery_subscriptions(report_type)
"#;

pub async fn insert_delivery_subscription(
    pool: &sqlx::PgPool,
    record: &CssCaseDeliverySubscriptionRecord,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        INSERT INTO css_case_delivery_subscriptions (
            subscription_id, user_id, status, frequency, delivery_mode, delivery_target_json,
            report_type, export_format, days, preview_limit, created_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
        "#,
    )
    .bind(&record.subscription_id)
    .bind(&record.user_id)
    .bind(status_to_db(&record.status))
    .bind(frequency_to_db(&record.frequency))
    .bind(delivery_mode_to_db(&record.delivery_mode))
    .bind(sqlx::types::Json(&record.delivery_target))
    .bind(report_type_to_db(&record.report_type))
    .bind(record.export_format.as_ref().map(export_format_to_db))
    .bind(record.days.map(|x| x as i32))
    .bind(record.preview_limit.map(|x| x as i32))
    .bind(&record.created_at)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn get_delivery_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> anyhow::Result<Option<CssCaseDeliverySubscriptionRecord>> {
    let row = sqlx::query(
        r#"
        SELECT subscription_id, user_id, status, frequency, delivery_mode, delivery_target_json,
               report_type, export_format, days, preview_limit, created_at::text AS created_at
        FROM css_case_delivery_subscriptions
        WHERE subscription_id = $1
        "#,
    )
    .bind(subscription_id)
    .fetch_optional(pool)
    .await?;

    row.map(row_to_delivery_subscription).transpose()
}

pub async fn list_delivery_subscriptions(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssCaseDeliverySubscriptionRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT subscription_id, user_id, status, frequency, delivery_mode, delivery_target_json,
               report_type, export_format, days, preview_limit, created_at::text AS created_at
        FROM css_case_delivery_subscriptions
        ORDER BY created_at DESC, subscription_id DESC
        "#,
    )
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_delivery_subscription).collect()
}

pub async fn list_delivery_subscriptions_for_user(
    pool: &sqlx::PgPool,
    user_id: &str,
) -> anyhow::Result<Vec<CssCaseDeliverySubscriptionRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT subscription_id, user_id, status, frequency, delivery_mode, delivery_target_json,
               report_type, export_format, days, preview_limit, created_at::text AS created_at
        FROM css_case_delivery_subscriptions
        WHERE user_id = $1
        ORDER BY created_at DESC, subscription_id DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_delivery_subscription).collect()
}

pub async fn list_active_delivery_subscriptions(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<CssCaseDeliverySubscriptionRecord>> {
    let rows = sqlx::query(
        r#"
        SELECT subscription_id, user_id, status, frequency, delivery_mode, delivery_target_json,
               report_type, export_format, days, preview_limit, created_at::text AS created_at
        FROM css_case_delivery_subscriptions
        WHERE status = $1
        ORDER BY created_at DESC, subscription_id DESC
        "#,
    )
    .bind(status_to_db(&DeliverySubscriptionStatus::Active))
    .fetch_all(pool)
    .await?;

    rows.into_iter().map(row_to_delivery_subscription).collect()
}

pub async fn update_delivery_subscription_status(
    pool: &sqlx::PgPool,
    subscription_id: &str,
    status: DeliverySubscriptionStatus,
) -> anyhow::Result<()> {
    sqlx::query(
        r#"
        UPDATE css_case_delivery_subscriptions
        SET status = $2
        WHERE subscription_id = $1
        "#,
    )
    .bind(subscription_id)
    .bind(status_to_db(&status))
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn update_delivery_subscription(
    pool: &sqlx::PgPool,
    req: UpdateDeliverySubscriptionRequest,
) -> anyhow::Result<()> {
    if let Some(status) = req.status {
        update_delivery_subscription_status(pool, &req.subscription_id, status).await?;
    }

    if let Some(frequency) = req.frequency {
        sqlx::query(
            r#"
            UPDATE css_case_delivery_subscriptions
            SET frequency = $2
            WHERE subscription_id = $1
            "#,
        )
        .bind(&req.subscription_id)
        .bind(frequency_to_db(&frequency))
        .execute(pool)
        .await?;
    }

    Ok(())
}

fn row_to_delivery_subscription(
    row: sqlx::postgres::PgRow,
) -> anyhow::Result<CssCaseDeliverySubscriptionRecord> {
    let delivery_target: sqlx::types::Json<DeliverySubscriptionTarget> =
        row.try_get("delivery_target_json")?;

    Ok(CssCaseDeliverySubscriptionRecord {
        subscription_id: row.try_get("subscription_id")?,
        user_id: row.try_get("user_id")?,
        status: status_from_db(&row.try_get::<String, _>("status")?)?,
        frequency: frequency_from_db(&row.try_get::<String, _>("frequency")?)?,
        delivery_mode: delivery_mode_from_db(&row.try_get::<String, _>("delivery_mode")?)?,
        delivery_target: delivery_target.0,
        report_type: report_type_from_db(&row.try_get::<String, _>("report_type")?)?,
        export_format: row
            .try_get::<Option<String>, _>("export_format")?
            .as_deref()
            .map(export_format_from_db)
            .transpose()?,
        days: row.try_get::<Option<i32>, _>("days")?.map(|x| x as usize),
        preview_limit: row
            .try_get::<Option<i32>, _>("preview_limit")?
            .map(|x| x as usize),
        created_at: row.try_get("created_at")?,
    })
}

fn status_to_db(status: &DeliverySubscriptionStatus) -> &'static str {
    match status {
        DeliverySubscriptionStatus::Active => "active",
        DeliverySubscriptionStatus::Paused => "paused",
    }
}

fn status_from_db(status: &str) -> anyhow::Result<DeliverySubscriptionStatus> {
    match status {
        "active" => Ok(DeliverySubscriptionStatus::Active),
        "paused" => Ok(DeliverySubscriptionStatus::Paused),
        _ => anyhow::bail!("unsupported delivery subscription status: {status}"),
    }
}

fn frequency_to_db(frequency: &DeliverySubscriptionFrequency) -> &'static str {
    match frequency {
        DeliverySubscriptionFrequency::Daily => "daily",
        DeliverySubscriptionFrequency::Weekly => "weekly",
    }
}

fn frequency_from_db(frequency: &str) -> anyhow::Result<DeliverySubscriptionFrequency> {
    match frequency {
        "daily" => Ok(DeliverySubscriptionFrequency::Daily),
        "weekly" => Ok(DeliverySubscriptionFrequency::Weekly),
        _ => anyhow::bail!("unsupported delivery subscription frequency: {frequency}"),
    }
}

fn delivery_mode_to_db(mode: &DeliveryApiMode) -> &'static str {
    match mode {
        DeliveryApiMode::Report => "report",
        DeliveryApiMode::Export => "export",
    }
}

fn delivery_mode_from_db(mode: &str) -> anyhow::Result<DeliveryApiMode> {
    match mode {
        "report" => Ok(DeliveryApiMode::Report),
        "export" => Ok(DeliveryApiMode::Export),
        _ => anyhow::bail!("unsupported delivery mode: {mode}"),
    }
}

fn report_type_to_db(kind: &DeliveryReportType) -> &'static str {
    match kind {
        DeliveryReportType::Dashboard => "dashboard",
        DeliveryReportType::Kpi => "kpi",
        DeliveryReportType::Analytics => "analytics",
        DeliveryReportType::Trends => "trends",
        DeliveryReportType::Alerts => "alerts",
        DeliveryReportType::Digest => "digest",
        DeliveryReportType::BriefingPack => "briefing_pack",
    }
}

fn report_type_from_db(kind: &str) -> anyhow::Result<DeliveryReportType> {
    match kind {
        "dashboard" => Ok(DeliveryReportType::Dashboard),
        "kpi" => Ok(DeliveryReportType::Kpi),
        "analytics" => Ok(DeliveryReportType::Analytics),
        "trends" => Ok(DeliveryReportType::Trends),
        "alerts" => Ok(DeliveryReportType::Alerts),
        "digest" => Ok(DeliveryReportType::Digest),
        "briefing_pack" => Ok(DeliveryReportType::BriefingPack),
        _ => anyhow::bail!("unsupported delivery report type: {kind}"),
    }
}

fn export_format_to_db(format: &DeliveryExportFormat) -> &'static str {
    match format {
        DeliveryExportFormat::JsonPackage => "json_package",
        DeliveryExportFormat::Csv => "csv",
        DeliveryExportFormat::BriefingText => "briefing_text",
        DeliveryExportFormat::Pdf => "pdf",
        DeliveryExportFormat::Docx => "docx",
    }
}

fn export_format_from_db(format: &str) -> anyhow::Result<DeliveryExportFormat> {
    match format {
        "json_package" | "json" => Ok(DeliveryExportFormat::JsonPackage),
        "csv" => Ok(DeliveryExportFormat::Csv),
        "briefing_text" => Ok(DeliveryExportFormat::BriefingText),
        "pdf" => Ok(DeliveryExportFormat::Pdf),
        "docx" => Ok(DeliveryExportFormat::Docx),
        _ => anyhow::bail!("unsupported delivery export format: {format}"),
    }
}

impl DeliveryApiTarget {
    fn _db_key(&self) -> &'static str {
        match self {
            DeliveryApiTarget::FrontendDownload => "frontend_download",
            DeliveryApiTarget::Bot => "bot",
            DeliveryApiTarget::Email => "email",
            DeliveryApiTarget::ThirdPartyClient => "third_party_client",
        }
    }
}
