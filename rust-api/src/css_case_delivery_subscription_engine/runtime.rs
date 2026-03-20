use crate::css_case_delivery_subscription_engine::types::{
    CreateDeliverySubscriptionRequest, CssCaseDeliverySubscriptionRecord,
    DeliverySubscriptionStatus,
};

pub fn build_delivery_subscription_record(
    req: CreateDeliverySubscriptionRequest,
    now_rfc3339: &str,
) -> CssCaseDeliverySubscriptionRecord {
    CssCaseDeliverySubscriptionRecord {
        subscription_id: format!("cdsub_{}", uuid::Uuid::new_v4()),
        user_id: req.user_id,
        status: DeliverySubscriptionStatus::Active,
        frequency: req.frequency,
        delivery_mode: req.delivery_mode,
        delivery_target: req.delivery_target,
        report_type: req.report_type,
        export_format: req.export_format,
        days: req.days,
        preview_limit: req.preview_limit,
        created_at: now_rfc3339.to_string(),
    }
}

pub async fn create_delivery_subscription(
    pool: &sqlx::PgPool,
    req: CreateDeliverySubscriptionRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliverySubscriptionRecord> {
    let record = build_delivery_subscription_record(req, now_rfc3339);
    crate::css_case_delivery_subscription_engine::store_pg::insert_delivery_subscription(
        pool, &record,
    )
    .await?;
    Ok(record)
}

pub async fn pause_delivery_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> anyhow::Result<()> {
    crate::css_case_delivery_subscription_engine::store_pg::update_delivery_subscription_status(
        pool,
        subscription_id,
        DeliverySubscriptionStatus::Paused,
    )
    .await
}

pub async fn resume_delivery_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> anyhow::Result<()> {
    crate::css_case_delivery_subscription_engine::store_pg::update_delivery_subscription_status(
        pool,
        subscription_id,
        DeliverySubscriptionStatus::Active,
    )
    .await
}

pub fn subscription_to_delivery_request(
    sub: &CssCaseDeliverySubscriptionRecord,
) -> crate::css_case_delivery_api::types::DeliveryApiRequest {
    crate::css_case_delivery_api::types::DeliveryApiRequest {
        mode: sub.delivery_mode.clone(),
        target: sub.delivery_target.target.clone(),
        report_type: sub.report_type.clone(),
        export_format: sub.export_format.clone(),
        days: sub.days,
        preview_limit: sub.preview_limit,
        today_yyyy_mm_dd: None,
    }
}

pub fn subscription_to_delivery_request_v2(
    sub: &CssCaseDeliverySubscriptionRecord,
) -> crate::css_case_delivery_delivery_api::types::DeliveryApiRequest {
    crate::css_case_delivery_delivery_api::types::DeliveryApiRequest {
        report_kind: sub.report_type.clone(),
        mode: match sub.delivery_mode {
            crate::css_case_delivery_api::types::DeliveryApiMode::Report => {
                crate::css_case_delivery_delivery_api::types::DeliveryApiMode::Report
            }
            crate::css_case_delivery_api::types::DeliveryApiMode::Export => {
                crate::css_case_delivery_delivery_api::types::DeliveryApiMode::Export
            }
        },
        export_format: sub.export_format.clone(),
        days: sub.days,
        preview_limit: sub.preview_limit,
    }
}

pub async fn execute_delivery_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_api::types::CssCaseDeliveryApiResponse> {
    let sub = crate::css_case_delivery_subscription_engine::store_pg::get_delivery_subscription(
        pool,
        subscription_id,
    )
    .await?
    .ok_or_else(|| anyhow::anyhow!("subscription not found"))?;

    if !matches!(sub.status, DeliverySubscriptionStatus::Active) {
        anyhow::bail!("subscription is not active");
    }

    let mut req = subscription_to_delivery_request(&sub);
    req.today_yyyy_mm_dd = Some(now_rfc3339.get(0..10).unwrap_or("2026-03-14").to_string());

    crate::css_case_delivery_api::runtime::deliver(pool, req, now_rfc3339).await
}

pub async fn run_delivery_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<crate::css_case_delivery_delivery_api::types::CssCaseDeliveryApiResponse> {
    let sub = crate::css_case_delivery_subscription_engine::store_pg::get_delivery_subscription(
        pool,
        subscription_id,
    )
    .await?
    .ok_or_else(|| anyhow::anyhow!("subscription not found"))?;

    if !matches!(sub.status, DeliverySubscriptionStatus::Active) {
        anyhow::bail!("subscription is not active");
    }

    let req = subscription_to_delivery_request_v2(&sub);
    crate::css_case_delivery_delivery_api::runtime::deliver(pool, req, now_rfc3339).await
}
