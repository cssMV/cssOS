use crate::css_case_delivery_retry_engine::types::{
    CssCaseDeliveryRetryResult, DeliveryRetryLookup, DeliveryRetryRequest,
};

fn request_from_delivery_log(
    log: &crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord,
) -> crate::css_case_delivery_api::types::DeliveryApiRequest {
    crate::css_case_delivery_api::types::DeliveryApiRequest {
        mode: log.delivery_mode.clone(),
        target: log.delivery_target.clone(),
        report_type: log.report_type.clone(),
        export_format: log.export_format.clone(),
        days: None,
        preview_limit: None,
        today_yyyy_mm_dd: None,
    }
}

async fn failed_logs(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Vec<crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord>> {
    let mut logs = crate::css_case_delivery_log::store_pg::list_all_delivery_logs(pool).await?;
    logs.retain(|x| !x.succeeded);
    logs.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(logs)
}

async fn latest_failed_log(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Option<crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord>> {
    let logs = failed_logs(pool).await?;
    Ok(logs.into_iter().next())
}

async fn latest_failed_log_by_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> anyhow::Result<Option<crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord>> {
    let mut logs = failed_logs(pool).await?;
    logs.retain(|x| x.subscription_id.as_deref() == Some(subscription_id));
    Ok(logs.into_iter().next())
}

async fn latest_failed_log_by_target_mode(
    pool: &sqlx::PgPool,
    target: &crate::css_case_delivery_api::types::DeliveryApiTarget,
    mode: &crate::css_case_delivery_api::types::DeliveryApiMode,
) -> anyhow::Result<Option<crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord>> {
    let mut logs = failed_logs(pool).await?;
    logs.retain(|x| &x.delivery_target == target && &x.delivery_mode == mode);
    Ok(logs.into_iter().next())
}

async fn failed_log_by_id(
    pool: &sqlx::PgPool,
    delivery_log_id: &str,
) -> anyhow::Result<Option<crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord>> {
    let log =
        crate::css_case_delivery_log::store_pg::get_delivery_log(pool, delivery_log_id).await?;
    Ok(if !log.succeeded { Some(log) } else { None })
}

async fn resolve_retry_log(
    pool: &sqlx::PgPool,
    lookup: &DeliveryRetryLookup,
) -> anyhow::Result<Option<crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord>> {
    match lookup {
        DeliveryRetryLookup::LatestFailed => latest_failed_log(pool).await,
        DeliveryRetryLookup::BySubscription { subscription_id } => {
            latest_failed_log_by_subscription(pool, subscription_id).await
        }
        DeliveryRetryLookup::ByTargetMode { target, mode } => {
            latest_failed_log_by_target_mode(pool, target, mode).await
        }
        DeliveryRetryLookup::ByDeliveryLog { delivery_log_id } => {
            failed_log_by_id(pool, delivery_log_id).await
        }
    }
}

pub async fn retry_delivery(
    pool: &sqlx::PgPool,
    req: DeliveryRetryRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryRetryResult> {
    let failed = match resolve_retry_log(pool, &req.lookup).await? {
        Some(log) => log,
        None => {
            return Ok(CssCaseDeliveryRetryResult {
                retried: false,
                message: "no failed delivery log found for retry".into(),
                previous_delivery_log_id: None,
                new_delivery_log_id: None,
            });
        }
    };

    let retry_req = request_from_delivery_log(&failed);
    let new_log = crate::css_case_delivery_log::runtime::deliver_and_log(
        pool,
        failed.subscription_id.clone(),
        retry_req.clone(),
        now_rfc3339,
    )
    .await?;

    let _ = crate::css_case_delivery_signals_invalidation::runtime::invalidate_on_retry_outcome_changed(
        pool,
        failed.target.clone(),
        failed.mode.clone(),
        now_rfc3339,
    )
    .await;

    Ok(CssCaseDeliveryRetryResult {
        retried: true,
        message: if new_log.succeeded {
            "retry executed successfully".into()
        } else {
            "retry executed but still failed".into()
        },
        previous_delivery_log_id: Some(failed.delivery_log_id),
        new_delivery_log_id: Some(new_log.delivery_log_id),
    })
}
