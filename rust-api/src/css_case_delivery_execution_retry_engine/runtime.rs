use crate::css_case_delivery_execution_retry_engine::types::{
    CssCaseDeliveryRetryResult, DeliveryRetryLookup, DeliveryRetryRequest,
};
use crate::css_case_delivery_log::types::{
    CaseDeliveryLogCreateRequest, CaseDeliveryLogFormat, CaseDeliveryLogMode,
    CssCaseDeliveryLogRecord,
};

fn delivery_request_from_log(
    log: &CssCaseDeliveryLogRecord,
) -> crate::css_case_delivery_delivery_api::types::DeliveryApiRequest {
    crate::css_case_delivery_delivery_api::types::DeliveryApiRequest {
        report_kind: log.report_type.clone(),
        mode: match log.delivery_mode {
            crate::css_case_delivery_api::types::DeliveryApiMode::Report => {
                crate::css_case_delivery_delivery_api::types::DeliveryApiMode::Report
            }
            crate::css_case_delivery_api::types::DeliveryApiMode::Export => {
                crate::css_case_delivery_delivery_api::types::DeliveryApiMode::Export
            }
        },
        export_format: log.export_format.clone(),
        days: None,
        preview_limit: None,
    }
}

fn log_format_from_request(
    req: &crate::css_case_delivery_delivery_api::types::DeliveryApiRequest,
) -> CaseDeliveryLogFormat {
    match req.mode {
        crate::css_case_delivery_delivery_api::types::DeliveryApiMode::Report => {
            CaseDeliveryLogFormat::Json
        }
        crate::css_case_delivery_delivery_api::types::DeliveryApiMode::Export => match req
            .export_format
            .clone()
            .unwrap_or(
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage,
            ) {
            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage => {
                CaseDeliveryLogFormat::Json
            }
            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Csv => {
                CaseDeliveryLogFormat::Csv
            }
            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText => {
                CaseDeliveryLogFormat::Text
            }
            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Pdf => {
                CaseDeliveryLogFormat::Pdf
            }
            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Docx => {
                CaseDeliveryLogFormat::Docx
            }
        },
    }
}

fn latest_failed_delivery_log_query() -> crate::css_case_delivery_log::types::DeliveryLogQueryRequest
{
    crate::css_case_delivery_log::types::DeliveryLogQueryRequest {
        subscription_id: None,
        target: None,
        mode: None,
        api_mode: None,
        delivered: None,
        report_type: None,
        succeeded: Some(false),
        limit: Some(1),
    }
}

async fn latest_failed_delivery_log(
    pool: &sqlx::PgPool,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    let logs = crate::css_case_delivery_log::runtime::query_delivery_logs(
        pool,
        latest_failed_delivery_log_query(),
    )
    .await?;
    Ok(logs.into_iter().next())
}

async fn latest_failed_delivery_log_for_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    crate::css_case_delivery_log::store_pg::get_latest_failed_delivery_log_for_subscription(
        pool,
        subscription_id,
    )
    .await
}

async fn get_failed_delivery_log(
    pool: &sqlx::PgPool,
    delivery_log_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    let log =
        crate::css_case_delivery_log::store_pg::get_delivery_log(pool, delivery_log_id).await?;
    Ok((!log.succeeded).then_some(log))
}

async fn latest_failed_delivery_log_by_target_mode(
    pool: &sqlx::PgPool,
    report_kind: &crate::css_case_delivery_report_api::types::DeliveryReportKind,
    mode: &crate::css_case_delivery_delivery_api::types::DeliveryApiMode,
    export_format: &Option<crate::css_case_delivery_export_engine::types::DeliveryExportFormat>,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    let logs = crate::css_case_delivery_log::runtime::query_delivery_logs(
        pool,
        crate::css_case_delivery_log::types::DeliveryLogQueryRequest {
            subscription_id: None,
            target: None,
            mode: None,
            api_mode: None,
            delivered: None,
            report_type: Some(report_kind.clone()),
            succeeded: Some(false),
            limit: None,
        },
    )
    .await?;

    Ok(logs
        .into_iter()
        .filter(|log| {
            let log_mode = match log.delivery_mode {
                crate::css_case_delivery_api::types::DeliveryApiMode::Report => {
                    crate::css_case_delivery_delivery_api::types::DeliveryApiMode::Report
                }
                crate::css_case_delivery_api::types::DeliveryApiMode::Export => {
                    crate::css_case_delivery_delivery_api::types::DeliveryApiMode::Export
                }
            };
            &log_mode == mode && &log.export_format == export_format
        })
        .next())
}

async fn resolve_retry_log(
    pool: &sqlx::PgPool,
    lookup: &DeliveryRetryLookup,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    match lookup {
        DeliveryRetryLookup::LatestFailed => latest_failed_delivery_log(pool).await,
        DeliveryRetryLookup::BySubscription { subscription_id } => {
            latest_failed_delivery_log_for_subscription(pool, subscription_id).await
        }
        DeliveryRetryLookup::ByDeliveryLog { delivery_log_id } => {
            get_failed_delivery_log(pool, delivery_log_id).await
        }
        DeliveryRetryLookup::ByTargetMode {
            report_kind,
            mode,
            export_format,
        } => {
            latest_failed_delivery_log_by_target_mode(pool, report_kind, mode, export_format).await
        }
    }
}

pub async fn retry_delivery_execution(
    pool: &sqlx::PgPool,
    req: DeliveryRetryRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryRetryResult> {
    let original = match resolve_retry_log(pool, &req.lookup).await? {
        Some(log) => log,
        None => {
            return Ok(CssCaseDeliveryRetryResult {
                retried: false,
                message: "no failed delivery log found for retry".into(),
                original_delivery_log_id: None,
                new_delivery_log_id: None,
                succeeded: None,
                result_summary: None,
            });
        }
    };

    let delivery_req = delivery_request_from_log(&original);
    let delivery_result = crate::css_case_delivery_delivery_api::runtime::deliver(
        pool,
        delivery_req.clone(),
        now_rfc3339,
    )
    .await;

    let target =
        crate::css_case_delivery_log::runtime::target_from_report_kind(&delivery_req.report_kind);
    let mode = CaseDeliveryLogMode::ApiBundle;
    let format = log_format_from_request(&delivery_req);

    let new_log = match delivery_result {
        Ok(ok) => {
            let (message, payload_name) = match &ok.data {
                crate::css_case_delivery_delivery_api::types::DeliveryApiPayload::Report(_) => {
                    ("retry delivery report succeeded".to_string(), None)
                }
                crate::css_case_delivery_delivery_api::types::DeliveryApiPayload::Export(
                    artifact,
                ) => (
                    "retry delivery export succeeded".to_string(),
                    Some(artifact.file_name.clone()),
                ),
            };

            crate::css_case_delivery_log::runtime::write_delivery_log(
                pool,
                CaseDeliveryLogCreateRequest {
                    subscription_id: original.subscription_id.clone(),
                    subscriber_id: original.subscriber_id.clone(),
                    target: target.clone(),
                    format,
                    mode: mode.clone(),
                    api_mode: Some(original.delivery_mode.clone()),
                    delivered: true,
                    message,
                    payload_name,
                    delivery_mode: original.delivery_mode.clone(),
                    delivery_target: original.delivery_target.clone(),
                    report_type: original.report_type.clone(),
                    export_format: original.export_format.clone(),
                    succeeded: true,
                    result_message:
                        crate::css_case_delivery_log::runtime::result_summary_from_delivery_response_v2(&ok),
                },
                now_rfc3339,
            )
            .await?
        }
        Err(err) => {
            crate::css_case_delivery_log::runtime::write_delivery_log(
                pool,
                CaseDeliveryLogCreateRequest {
                    subscription_id: original.subscription_id.clone(),
                    subscriber_id: original.subscriber_id.clone(),
                    target: target.clone(),
                    format,
                    mode: mode.clone(),
                    api_mode: Some(original.delivery_mode.clone()),
                    delivered: false,
                    message: "retry delivery failed".to_string(),
                    payload_name: None,
                    delivery_mode: original.delivery_mode.clone(),
                    delivery_target: original.delivery_target.clone(),
                    report_type: original.report_type.clone(),
                    export_format: original.export_format.clone(),
                    succeeded: false,
                    result_message: err.to_string(),
                },
                now_rfc3339,
            )
            .await?
        }
    };

    let _ = crate::css_case_delivery_signals_invalidation::runtime::invalidate_on_retry_outcome_changed(
        pool,
        target,
        mode,
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
        original_delivery_log_id: Some(original.delivery_log_id),
        new_delivery_log_id: Some(new_log.delivery_log_id.clone()),
        succeeded: Some(new_log.succeeded),
        result_summary: Some(new_log.result_message),
    })
}
