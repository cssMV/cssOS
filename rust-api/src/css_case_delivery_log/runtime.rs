use crate::css_case_delivery_api::types::CaseDeliveryMode;
use crate::css_case_delivery_export_engine::types::{DeliveryExportFormat, DeliveryExportTarget};
use crate::css_case_delivery_log::types::{
    CaseDeliveryLogCreateRequest, CaseDeliveryLogFormat, CaseDeliveryLogMode,
    CaseDeliveryLogTarget, CssCaseDeliveryLogRecord,
};

fn map_target(target: &DeliveryExportTarget) -> CaseDeliveryLogTarget {
    match target {
        DeliveryExportTarget::Bundle => CaseDeliveryLogTarget::ReportBundle,
        DeliveryExportTarget::Digest => CaseDeliveryLogTarget::Digest,
        DeliveryExportTarget::Briefing => CaseDeliveryLogTarget::Briefing,
        DeliveryExportTarget::Dashboard => CaseDeliveryLogTarget::Dashboard,
        DeliveryExportTarget::Kpi => CaseDeliveryLogTarget::Kpi,
        DeliveryExportTarget::Analytics => CaseDeliveryLogTarget::Analytics,
        DeliveryExportTarget::Trends => CaseDeliveryLogTarget::Trends,
        DeliveryExportTarget::Alerts => CaseDeliveryLogTarget::Alerts,
    }
}

fn map_format(format: &DeliveryExportFormat) -> CaseDeliveryLogFormat {
    match format {
        DeliveryExportFormat::JsonPackage => CaseDeliveryLogFormat::Json,
        DeliveryExportFormat::Csv => CaseDeliveryLogFormat::Csv,
        DeliveryExportFormat::BriefingText => CaseDeliveryLogFormat::Text,
        DeliveryExportFormat::Pdf => CaseDeliveryLogFormat::Pdf,
        DeliveryExportFormat::Docx => CaseDeliveryLogFormat::Docx,
    }
}

fn map_mode(mode: &CaseDeliveryMode) -> CaseDeliveryLogMode {
    match mode {
        CaseDeliveryMode::Download => CaseDeliveryLogMode::Download,
        CaseDeliveryMode::Attachment => CaseDeliveryLogMode::Attachment,
        CaseDeliveryMode::RobotPull => CaseDeliveryLogMode::RobotPull,
        CaseDeliveryMode::ApiBundle => CaseDeliveryLogMode::ApiBundle,
    }
}

fn delivery_target_from_log_mode(
    mode: &CaseDeliveryLogMode,
) -> crate::css_case_delivery_api::types::DeliveryApiTarget {
    match mode {
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
    }
}

fn report_type_from_target(
    target: &CaseDeliveryLogTarget,
) -> crate::css_case_delivery_report_api::types::DeliveryReportType {
    match target {
        CaseDeliveryLogTarget::ReportBundle => {
            crate::css_case_delivery_report_api::types::DeliveryReportType::BriefingPack
        }
        CaseDeliveryLogTarget::Digest => {
            crate::css_case_delivery_report_api::types::DeliveryReportType::Digest
        }
        CaseDeliveryLogTarget::Briefing => {
            crate::css_case_delivery_report_api::types::DeliveryReportType::BriefingPack
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
    }
}

pub fn build_delivery_log_record(
    subscription_id: Option<String>,
    subscriber_id: Option<String>,
    target: &DeliveryExportTarget,
    format: &DeliveryExportFormat,
    mode: &CaseDeliveryMode,
    delivered: bool,
    message: String,
    payload_name: Option<String>,
    now_rfc3339: &str,
) -> CssCaseDeliveryLogRecord {
    let api_mode = crate::css_case_delivery_api::types::DeliveryApiMode::Export;
    let log_mode = map_mode(mode);
    let log_target = map_target(target);
    let log_format = map_format(format);
    let report_type = report_type_from_target(&log_target);
    let result_message = payload_name
        .clone()
        .map(|name| format!("delivery artifact generated: {name}"))
        .unwrap_or_else(|| {
            if delivered {
                "delivery executed successfully".into()
            } else {
                "delivery execution failed".into()
            }
        });

    CssCaseDeliveryLogRecord {
        delivery_log_id: format!("cdl_{}", uuid::Uuid::new_v4()),
        subscription_id,
        subscriber_id,
        target: log_target,
        format: log_format.clone(),
        mode: log_mode.clone(),
        api_mode: Some(api_mode.clone()),
        delivered,
        message,
        payload_name,
        delivery_mode: api_mode,
        delivery_target: delivery_target_from_log_mode(&log_mode),
        report_type,
        export_format: Some(format.clone()),
        succeeded: delivered,
        result_message,
        created_at: now_rfc3339.to_string(),
    }
}

pub async fn write_delivery_log_record(
    pool: &sqlx::PgPool,
    record: &CssCaseDeliveryLogRecord,
) -> anyhow::Result<()> {
    crate::css_case_delivery_log::store_pg::insert_delivery_log(pool, record).await
}

pub fn target_from_report_kind(
    kind: &crate::css_case_delivery_report_api::types::DeliveryReportKind,
) -> CaseDeliveryLogTarget {
    match kind {
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Dashboard => {
            CaseDeliveryLogTarget::Dashboard
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Kpi => {
            CaseDeliveryLogTarget::Kpi
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Analytics => {
            CaseDeliveryLogTarget::Analytics
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Trends => {
            CaseDeliveryLogTarget::Trends
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Alerts => {
            CaseDeliveryLogTarget::Alerts
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Digest => {
            CaseDeliveryLogTarget::Digest
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::BriefingPack => {
            CaseDeliveryLogTarget::Briefing
        }
    }
}

pub fn mode_from_delivery_api_mode(
    mode: &crate::css_case_delivery_api::types::DeliveryApiMode,
) -> CaseDeliveryLogMode {
    match mode {
        // Delivery API itself is currently served over the unified API bundle path.
        crate::css_case_delivery_api::types::DeliveryApiMode::Report => {
            CaseDeliveryLogMode::ApiBundle
        }
        crate::css_case_delivery_api::types::DeliveryApiMode::Export => {
            CaseDeliveryLogMode::ApiBundle
        }
    }
}

fn format_from_delivery_request(
    req: &crate::css_case_delivery_api::types::GetDeliveryApiRequest,
) -> CaseDeliveryLogFormat {
    match req.mode {
        crate::css_case_delivery_api::types::DeliveryApiMode::Report => CaseDeliveryLogFormat::Json,
        crate::css_case_delivery_api::types::DeliveryApiMode::Export => match req.format {
            Some(
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage,
            ) => CaseDeliveryLogFormat::Json,
            Some(crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Csv) => {
                CaseDeliveryLogFormat::Csv
            }
            Some(
                crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText,
            ) => CaseDeliveryLogFormat::Text,
            Some(crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Pdf) => {
                CaseDeliveryLogFormat::Pdf
            }
            Some(crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Docx) => {
                CaseDeliveryLogFormat::Docx
            }
            None => CaseDeliveryLogFormat::Json,
        },
    }
}

pub fn build_delivery_log_from_request(
    req: CaseDeliveryLogCreateRequest,
    now_rfc3339: &str,
) -> CssCaseDeliveryLogRecord {
    CssCaseDeliveryLogRecord {
        delivery_log_id: format!("cdl_{}", uuid::Uuid::new_v4()),
        subscription_id: req.subscription_id,
        subscriber_id: req.subscriber_id,
        target: req.target,
        format: req.format,
        mode: req.mode,
        api_mode: req.api_mode,
        delivered: req.delivered,
        message: req.message,
        payload_name: req.payload_name,
        delivery_mode: req.delivery_mode,
        delivery_target: req.delivery_target,
        report_type: req.report_type,
        export_format: req.export_format,
        succeeded: req.succeeded,
        result_message: req.result_message,
        created_at: now_rfc3339.to_string(),
    }
}

pub async fn write_delivery_log(
    pool: &sqlx::PgPool,
    req: CaseDeliveryLogCreateRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryLogRecord> {
    let record = build_delivery_log_from_request(req, now_rfc3339);
    crate::css_case_delivery_log::store_pg::insert_delivery_log(pool, &record).await?;
    let _ = crate::css_case_delivery_signals_invalidation::runtime::invalidate_on_delivery_log_appended(
        pool,
        record.target.clone(),
        record.mode.clone(),
        now_rfc3339,
    )
    .await;
    Ok(record)
}

pub fn result_summary_from_delivery_response_v2(
    response: &crate::css_case_delivery_delivery_api::types::CssCaseDeliveryApiResponse,
) -> String {
    match &response.data {
        crate::css_case_delivery_delivery_api::types::DeliveryApiPayload::Report(report) => {
            format!("report generated: {:?}", report.meta.kind)
        }
        crate::css_case_delivery_delivery_api::types::DeliveryApiPayload::Export(export) => {
            format!(
                "export generated: file_name={}, content_type={}",
                export.file_name, export.content_type
            )
        }
    }
}

pub async fn run_subscription_and_log(
    pool: &sqlx::PgPool,
    subscription_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    let sub =
        match crate::css_case_delivery_subscription_engine::store_pg::get_delivery_subscription(
            pool,
            subscription_id,
        )
        .await?
        {
            Some(x) => x,
            None => return Ok(None),
        };

    if !matches!(
        sub.status,
        crate::css_case_delivery_subscription_engine::types::DeliverySubscriptionStatus::Active
    ) {
        return Ok(None);
    }

    let req =
        crate::css_case_delivery_subscription_engine::runtime::subscription_to_delivery_request_v2(
            &sub,
        );
    let result =
        crate::css_case_delivery_delivery_api::runtime::deliver(pool, req.clone(), now_rfc3339)
            .await;

    let target = target_from_report_kind(&req.report_kind);
    let mode = match req.mode {
        crate::css_case_delivery_delivery_api::types::DeliveryApiMode::Report => {
            CaseDeliveryLogMode::ApiBundle
        }
        crate::css_case_delivery_delivery_api::types::DeliveryApiMode::Export => {
            CaseDeliveryLogMode::ApiBundle
        }
    };
    let format = match req.mode {
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
    };

    let log = match result {
        Ok(ok) => {
            let (message, payload_name) = match &ok.data {
                crate::css_case_delivery_delivery_api::types::DeliveryApiPayload::Report(_) => {
                    ("subscription report delivered".to_string(), None)
                }
                crate::css_case_delivery_delivery_api::types::DeliveryApiPayload::Export(
                    artifact,
                ) => (
                    "subscription export delivered".to_string(),
                    Some(artifact.file_name.clone()),
                ),
            };

            write_delivery_log(
                pool,
                CaseDeliveryLogCreateRequest {
                    subscription_id: Some(sub.subscription_id.clone()),
                    subscriber_id: Some(sub.user_id.clone()),
                    target,
                    format,
                    mode,
                    api_mode: Some(sub.delivery_mode.clone()),
                    delivered: true,
                    message,
                    payload_name,
                    delivery_mode: sub.delivery_mode.clone(),
                    delivery_target: sub.delivery_target.target.clone(),
                    report_type: sub.report_type.clone(),
                    export_format: sub.export_format.clone(),
                    succeeded: true,
                    result_message: result_summary_from_delivery_response_v2(&ok),
                },
                now_rfc3339,
            )
            .await?
        }
        Err(err) => {
            write_delivery_log(
                pool,
                CaseDeliveryLogCreateRequest {
                    subscription_id: Some(sub.subscription_id.clone()),
                    subscriber_id: Some(sub.user_id.clone()),
                    target,
                    format,
                    mode,
                    api_mode: Some(sub.delivery_mode.clone()),
                    delivered: false,
                    message: "subscription delivery failed".to_string(),
                    payload_name: None,
                    delivery_mode: sub.delivery_mode.clone(),
                    delivery_target: sub.delivery_target.target.clone(),
                    report_type: sub.report_type.clone(),
                    export_format: sub.export_format.clone(),
                    succeeded: false,
                    result_message: err.to_string(),
                },
                now_rfc3339,
            )
            .await?
        }
    };

    Ok(Some(log))
}

pub async fn query_delivery_logs(
    pool: &sqlx::PgPool,
    req: crate::css_case_delivery_log::types::DeliveryLogQueryRequest,
) -> anyhow::Result<Vec<CssCaseDeliveryLogRecord>> {
    let mut logs = crate::css_case_delivery_log::store_pg::list_all_delivery_logs(pool).await?;

    logs.retain(|x| {
        if let Some(subscription_id) = &req.subscription_id {
            if x.subscription_id.as_ref() != Some(subscription_id) {
                return false;
            }
        }

        if let Some(target) = &req.target {
            if &x.target != target {
                return false;
            }
        }

        if let Some(mode) = &req.mode {
            if &x.mode != mode {
                return false;
            }
        }

        if let Some(api_mode) = &req.api_mode {
            if x.api_mode.as_ref() != Some(api_mode) {
                return false;
            }
        }

        if let Some(delivered) = req.delivered {
            if x.delivered != delivered {
                return false;
            }
        }

        if let Some(report_type) = &req.report_type {
            if &x.report_type != report_type {
                return false;
            }
        }

        if let Some(succeeded) = req.succeeded {
            if x.succeeded != succeeded {
                return false;
            }
        }

        true
    });

    logs.sort_by(|a, b| b.created_at.cmp(&a.created_at));

    if let Some(limit) = req.limit {
        logs.truncate(limit);
    }

    Ok(logs)
}

pub async fn latest_delivery_log_for_subscription(
    pool: &sqlx::PgPool,
    subscription_id: &str,
) -> anyhow::Result<Option<CssCaseDeliveryLogRecord>> {
    crate::css_case_delivery_log::store_pg::get_latest_delivery_log_for_subscription(
        pool,
        subscription_id,
    )
    .await
}

pub fn result_message_from_response(
    resp: &crate::css_case_delivery_api::types::CssCaseDeliveryApiResponse,
) -> String {
    match &resp.payload {
        crate::css_case_delivery_api::types::DeliveryApiPayload::Report(_) => {
            format!("report delivered: {:?}", resp.report_type)
        }
        crate::css_case_delivery_api::types::DeliveryApiPayload::Export(x) => {
            format!("export delivered: {:?} ({})", x.format, x.content_type)
        }
    }
}

pub async fn log_delivery_result(
    pool: &sqlx::PgPool,
    subscription_id: Option<String>,
    req: &crate::css_case_delivery_api::types::GetDeliveryApiRequest,
    resp: &crate::css_case_delivery_api::types::CssCaseDeliveryApiResponse,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryLogRecord> {
    let (message, payload_name) = match &resp.payload {
        crate::css_case_delivery_api::types::DeliveryApiPayload::Report(_) => {
            ("report delivered".to_string(), None)
        }
        crate::css_case_delivery_api::types::DeliveryApiPayload::Export(artifact) => (
            "export delivered".to_string(),
            Some(artifact.file_name.clone()),
        ),
    };

    write_delivery_log(
        pool,
        CaseDeliveryLogCreateRequest {
            subscription_id,
            subscriber_id: None,
            target: target_from_report_kind(&req.kind),
            format: format_from_delivery_request(req),
            mode: mode_from_delivery_api_mode(&req.mode),
            api_mode: Some(req.mode.clone()),
            delivered: true,
            message,
            payload_name,
            delivery_mode: req.mode.clone(),
            delivery_target:
                crate::css_case_delivery_api::types::DeliveryApiTarget::ThirdPartyClient,
            report_type: req.kind.clone(),
            export_format: req.format.clone(),
            succeeded: true,
            result_message: result_message_from_response(resp),
        },
        now_rfc3339,
    )
    .await
}

pub async fn log_delivery_failure(
    pool: &sqlx::PgPool,
    subscription_id: Option<String>,
    req: &crate::css_case_delivery_api::types::GetDeliveryApiRequest,
    error_message: String,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryLogRecord> {
    write_delivery_log(
        pool,
        CaseDeliveryLogCreateRequest {
            subscription_id,
            subscriber_id: None,
            target: target_from_report_kind(&req.kind),
            format: format_from_delivery_request(req),
            mode: mode_from_delivery_api_mode(&req.mode),
            api_mode: Some(req.mode.clone()),
            delivered: false,
            message: error_message,
            payload_name: None,
            delivery_mode: req.mode.clone(),
            delivery_target:
                crate::css_case_delivery_api::types::DeliveryApiTarget::ThirdPartyClient,
            report_type: req.kind.clone(),
            export_format: req.format.clone(),
            succeeded: false,
            result_message: "delivery execution failed".into(),
        },
        now_rfc3339,
    )
    .await
}

pub async fn log_subscription_delivery(
    pool: &sqlx::PgPool,
    subscription: &crate::css_case_subscription_engine::types::CaseSubscriptionSpec,
    result: &crate::css_case_subscription_engine::types::CaseSubscriptionExecutionResult,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryLogRecord> {
    let target = crate::css_case_subscription_engine::policy::export_target_for_subscription(
        &subscription.target,
    );
    let format = crate::css_case_subscription_engine::policy::export_format_for_subscription(
        &subscription.target,
    );
    let mode = crate::css_case_subscription_engine::policy::delivery_mode_for_subscription(
        &subscription.delivery_kind,
    );

    let record = build_delivery_log_record(
        Some(subscription.subscription_id.clone()),
        Some(subscription.subscriber_id.clone()),
        &target,
        &format,
        &mode,
        result.delivered,
        result.message.clone(),
        result.payload_name.clone(),
        now_rfc3339,
    );

    write_delivery_log_record(pool, &record).await?;
    Ok(record)
}

pub async fn deliver_and_log(
    pool: &sqlx::PgPool,
    subscription_id: Option<String>,
    req: crate::css_case_delivery_api::types::DeliveryApiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryLogRecord> {
    let delivery_result =
        crate::css_case_delivery_api::runtime::deliver(pool, req.clone(), now_rfc3339).await;

    match delivery_result {
        Ok(resp) => {
            let target = target_from_report_kind(&req.report_type);
            let format = match req.mode {
                crate::css_case_delivery_api::types::DeliveryApiMode::Report => {
                    CaseDeliveryLogFormat::Json
                }
                crate::css_case_delivery_api::types::DeliveryApiMode::Export => {
                    req.export_format
                        .clone()
                        .map(|x| match x {
                            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage => CaseDeliveryLogFormat::Json,
                            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Csv => CaseDeliveryLogFormat::Csv,
                            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText => CaseDeliveryLogFormat::Text,
                            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Pdf => CaseDeliveryLogFormat::Pdf,
                            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Docx => CaseDeliveryLogFormat::Docx,
                        })
                        .unwrap_or(CaseDeliveryLogFormat::Json)
                }
            };

            write_delivery_log(
                pool,
                CaseDeliveryLogCreateRequest {
                    subscription_id,
                    subscriber_id: None,
                    target,
                    format,
                    mode: mode_from_delivery_api_mode(&req.mode),
                    api_mode: Some(req.mode.clone()),
                    delivered: true,
                    message: result_message_from_response(&resp),
                    payload_name: match &resp.payload {
                        crate::css_case_delivery_api::types::DeliveryApiPayload::Export(x) => {
                            Some(x.file_name.clone())
                        }
                        crate::css_case_delivery_api::types::DeliveryApiPayload::Report(_) => None,
                    },
                    delivery_mode: req.mode,
                    delivery_target: req.target,
                    report_type: req.report_type,
                    export_format: req.export_format,
                    succeeded: true,
                    result_message: result_message_from_response(&resp),
                },
                now_rfc3339,
            )
            .await
        }
        Err(err) => {
            let error_message = err.to_string();
            let target = target_from_report_kind(&req.report_type);

            write_delivery_log(
                pool,
                CaseDeliveryLogCreateRequest {
                    subscription_id,
                    subscriber_id: None,
                    target,
                    format: req
                        .export_format
                        .clone()
                        .map(|x| match x {
                            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::JsonPackage => CaseDeliveryLogFormat::Json,
                            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Csv => CaseDeliveryLogFormat::Csv,
                            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText => CaseDeliveryLogFormat::Text,
                            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Pdf => CaseDeliveryLogFormat::Pdf,
                            crate::css_case_delivery_export_engine::types::DeliveryExportFormat::Docx => CaseDeliveryLogFormat::Docx,
                        })
                        .unwrap_or(CaseDeliveryLogFormat::Json),
                    mode: mode_from_delivery_api_mode(&req.mode),
                    api_mode: Some(req.mode.clone()),
                    delivered: false,
                    message: error_message.clone(),
                    payload_name: None,
                    delivery_mode: req.mode,
                    delivery_target: req.target,
                    report_type: req.report_type,
                    export_format: req.export_format,
                    succeeded: false,
                    result_message: error_message,
                },
                now_rfc3339,
            )
            .await
        }
    }
}

pub async fn execute_subscription_and_log(
    pool: &sqlx::PgPool,
    subscription_id: &str,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryLogRecord> {
    let sub = crate::css_case_delivery_subscription_engine::store_pg::get_delivery_subscription(
        pool,
        subscription_id,
    )
    .await?
    .ok_or_else(|| anyhow::anyhow!("subscription not found"))?;

    if !matches!(
        sub.status,
        crate::css_case_delivery_subscription_engine::types::DeliverySubscriptionStatus::Active
    ) {
        anyhow::bail!("subscription is not active");
    }

    let mut req =
        crate::css_case_delivery_subscription_engine::runtime::subscription_to_delivery_request(
            &sub,
        );
    req.today_yyyy_mm_dd = Some(now_rfc3339.get(0..10).unwrap_or("2026-03-14").to_string());

    deliver_and_log(pool, Some(sub.subscription_id), req, now_rfc3339).await
}

#[cfg(test)]
mod tests {
    #[test]
    fn v214_briefing_text_maps_to_delivery_text() {
        let mapped = super::map_format(
            &crate::css_case_delivery_export_engine::types::DeliveryExportFormat::BriefingText,
        );
        assert_eq!(
            mapped,
            crate::css_case_delivery_log::types::CaseDeliveryLogFormat::Text
        );
    }
}
