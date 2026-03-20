use crate::css_case_delivery_execution_status_view::types::{
    CssCaseDeliveryExecutionStatusView, DeliveryExecutionStatusKind,
    DeliveryExecutionStatusViewRequest,
};
use crate::css_case_delivery_log::types::CssCaseDeliveryLogRecord;

fn status_kind_from_log(log: &CssCaseDeliveryLogRecord) -> DeliveryExecutionStatusKind {
    if log.succeeded {
        DeliveryExecutionStatusKind::Succeeded
    } else {
        DeliveryExecutionStatusKind::Failed
    }
}

fn summary_from_log(log: &CssCaseDeliveryLogRecord) -> String {
    let action = match log.delivery_mode {
        crate::css_case_delivery_api::types::DeliveryApiMode::Report => {
            format!("{:?} report", log.report_type)
        }
        crate::css_case_delivery_api::types::DeliveryApiMode::Export => match &log.export_format {
            Some(fmt) => format!("{:?} export ({:?})", log.report_type, fmt),
            None => format!("{:?} export", log.report_type),
        },
    };

    if log.succeeded {
        format!("最近一次 {} 交付成功。", action)
    } else {
        format!("最近一次 {} 交付失败。", action)
    }
}

fn from_log(log: CssCaseDeliveryLogRecord) -> CssCaseDeliveryExecutionStatusView {
    let status = status_kind_from_log(&log);
    CssCaseDeliveryExecutionStatusView {
        execution_state: status.clone(),
        status,
        subscription_id: log.subscription_id.clone(),
        mode: log.delivery_mode.clone(),
        target: log.delivery_target.clone(),
        report_type: log.report_type.clone(),
        export_format: log.export_format.clone(),
        latest_delivery_log_id: Some(log.delivery_log_id.clone()),
        last_delivery_log_id: Some(log.delivery_log_id.clone()),
        result_summary: Some(log.result_message.clone()),
        last_result_message: Some(log.result_message.clone()),
        updated_at: Some(log.created_at.clone()),
        summary: summary_from_log(&log),
    }
}

fn empty_status() -> CssCaseDeliveryExecutionStatusView {
    CssCaseDeliveryExecutionStatusView {
        execution_state: DeliveryExecutionStatusKind::Unknown,
        status: DeliveryExecutionStatusKind::Unknown,
        subscription_id: None,
        mode: crate::css_case_delivery_api::types::DeliveryApiMode::Report,
        target: crate::css_case_delivery_api::types::DeliveryApiTarget::FrontendDownload,
        report_type: crate::css_case_delivery_report_api::types::DeliveryReportType::Digest,
        export_format: None,
        latest_delivery_log_id: None,
        last_delivery_log_id: None,
        result_summary: None,
        last_result_message: None,
        updated_at: None,
        summary: "当前暂无交付记录。".into(),
    }
}

async fn latest_by_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    crate::css_case_delivery_log::store_pg::get_latest_delivery_log_for_subscription(
        pool,
        subscription_id,
    )
    .await
}

async fn latest_by_delivery_shape(
    pool: &sqlx::PgPool,
    req: &DeliveryExecutionStatusViewRequest,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    let mut logs = crate::css_case_delivery_log::store_pg::list_all_delivery_logs(pool).await?;

    logs.retain(|x| {
        if let Some(mode) = &req.mode {
            if &x.delivery_mode != mode {
                return false;
            }
        }
        if let Some(target) = &req.target {
            if &x.delivery_target != target {
                return false;
            }
        }
        if let Some(report_type) = &req.report_type {
            if &x.report_type != report_type {
                return false;
            }
        }
        if let Some(export_format) = &req.export_format {
            if x.export_format.as_ref() != Some(export_format) {
                return false;
            }
        }
        true
    });

    logs.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(logs.into_iter().next())
}

pub async fn build_delivery_execution_status_view(
    pool: &sqlx::PgPool,
    req: DeliveryExecutionStatusViewRequest,
) -> anyhow::Result<CssCaseDeliveryExecutionStatusView> {
    let latest = if let Some(subscription_id) = &req.subscription_id {
        latest_by_subscription(pool, subscription_id).await?
    } else {
        latest_by_delivery_shape(pool, &req).await?
    };

    match latest {
        Some(log) => Ok(from_log(log)),
        None => Ok(empty_status()),
    }
}
