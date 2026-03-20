use crate::css_case_delivery_api::types::{
    CssCaseDeliveryApiResponse, DeliveryApiPayload, DeliveryApiRequest,
};
use crate::css_case_delivery_export_engine::types::{DeliveryExportRequest, DeliveryExportTarget};

fn report_kind_to_export_target(
    kind: &crate::css_case_delivery_report_api::types::DeliveryReportKind,
) -> DeliveryExportTarget {
    match kind {
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Dashboard => {
            DeliveryExportTarget::Dashboard
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Kpi => {
            DeliveryExportTarget::Kpi
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Analytics => {
            DeliveryExportTarget::Analytics
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Trends => {
            DeliveryExportTarget::Trends
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Alerts => {
            DeliveryExportTarget::Alerts
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::Digest => {
            DeliveryExportTarget::Digest
        }
        crate::css_case_delivery_report_api::types::DeliveryReportKind::BriefingPack => {
            DeliveryExportTarget::Briefing
        }
    }
}

fn request_day(now_rfc3339: &str, req: &DeliveryApiRequest) -> String {
    req.today_yyyy_mm_dd
        .clone()
        .unwrap_or_else(|| now_rfc3339.get(0..10).unwrap_or("2026-03-14").to_string())
}

async fn deliver_report(
    pool: &sqlx::PgPool,
    req: &DeliveryApiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryApiResponse> {
    let report = crate::css_case_delivery_report_api::runtime::build_delivery_report(
        pool,
        crate::css_case_delivery_report_api::types::DeliveryReportApiRequest {
            kind: req.report_type.clone(),
            days: req.days,
            preview_limit: req.preview_limit.or(Some(3)),
        },
        now_rfc3339,
    )
    .await?;

    Ok(CssCaseDeliveryApiResponse {
        mode: crate::css_case_delivery_api::types::DeliveryApiMode::Report,
        target: req.target.clone(),
        report_type: req.report_type.clone(),
        kind: req.report_type.clone(),
        payload: DeliveryApiPayload::Report(report),
    })
}

async fn deliver_export(
    pool: &sqlx::PgPool,
    req: &DeliveryApiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryApiResponse> {
    let format = req
        .export_format
        .clone()
        .ok_or_else(|| anyhow::anyhow!("export_format is required for export mode"))?;

    let export = crate::css_case_delivery_export_engine::runtime::export_delivery_report(
        pool,
        DeliveryExportRequest {
            report_kind: Some(req.report_type.clone()),
            report_type: Some(req.report_type.clone()),
            target: report_kind_to_export_target(&req.report_type),
            format,
            today_yyyy_mm_dd: request_day(now_rfc3339, req),
            days: req.days,
            preview_limit: req.preview_limit.or(Some(3)),
        },
    )
    .await?;

    Ok(CssCaseDeliveryApiResponse {
        mode: crate::css_case_delivery_api::types::DeliveryApiMode::Export,
        target: req.target.clone(),
        report_type: req.report_type.clone(),
        kind: req.report_type.clone(),
        payload: DeliveryApiPayload::Export(export),
    })
}

pub async fn deliver(
    pool: &sqlx::PgPool,
    req: DeliveryApiRequest,
    now_rfc3339: &str,
) -> anyhow::Result<CssCaseDeliveryApiResponse> {
    match req.mode {
        crate::css_case_delivery_api::types::DeliveryApiMode::Report => {
            deliver_report(pool, &req, now_rfc3339).await
        }
        crate::css_case_delivery_api::types::DeliveryApiMode::Export => {
            deliver_export(pool, &req, now_rfc3339).await
        }
    }
}
